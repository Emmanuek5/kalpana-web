import { z } from "zod";
import { generateObject } from "ai";
import puppeteer, { Browser, Page } from "puppeteer-core";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * Web Research Agent - Autonomous browser-based research
 * Uses Puppeteer for browser automation and AI SDK v5 for decisions
 * Pattern: Agent has its own tools and makes structured decisions
 */

// Global browser instance for the agent
let browserInstance: Browser | null = null;
let currentPage: Page | null = null;

// Page cache to avoid re-scraping
const pageCache = new Map<string, any>();

// Define a structured finding format
type Finding = {
  title: string;
  url: string;
  summary?: string;
  source?: string;
};

// Define the schema for the agent's available tools
const toolSchemas = z.union([
  z.object({
    tool: z.literal("goToPage"),
    url: z.string().url().describe("URL to navigate to"),
  }),
  z.object({
    tool: z.literal("extractText"),
    selector: z
      .string()
      .optional()
      .describe(
        "CSS selector to extract text from (optional, defaults to body)"
      ),
  }),
  z.object({
    tool: z.literal("clickElement"),
    selector: z.string().describe("CSS selector for the element to click"),
  }),
  z.object({
    tool: z.literal("getLinks"),
    limit: z.number().optional().describe("Max number of links to return"),
  }),
  z.object({
    tool: z.literal("updateScratchpad"),
    newData: z.string().describe("New information to add to notes"),
  }),
  z.object({
    tool: z.literal("saveFinding"),
    finding: z.object({
      title: z.string().min(1),
      url: z.string().url(),
      summary: z.string().optional(),
      source: z.string().optional(),
    }),
  }),
  z.object({
    tool: z.literal("sleep"),
    ms: z.number().int().min(100).max(5000).describe("Milliseconds to wait"),
  }),
  z.object({
    tool: z.literal("finishTask"),
    result: z.string().describe("Final summary of research findings"),
  }),
]);

type Tool = z.infer<typeof toolSchemas>;

export interface LocalAgentOptions {
  task: string;
  startUrl?: string;
  maxSteps?: number;
  performanceMode?: "fast" | "balanced" | "thorough";
  maxFindings?: number;
  model: any; // Required: Language model from main agent (uses user's API key)
}

export async function runLocalAgent(options: LocalAgentOptions) {
  const {
    task,
    startUrl,
    maxSteps = 20,
    performanceMode = "balanced",
    maxFindings = 10,
    model,
  } = options;

  pageCache.clear();
  let scratchpad = "";
  const findings: Finding[] = [];
  const visitedUrls = new Set<string>();
  const history: Array<{ action: Tool; result: any }> = [];

  try {
    // Model must be provided from the main agent to use user's API key
    if (!model) {
      throw new Error("Model is required for web research agent");
    }

    const agentModel = model;

    // Initialize browser
    await initBrowser();

    // Navigate to starting URL
    const initialUrl =
      startUrl || `https://www.google.com/search?q=${encodeURIComponent(task)}`;
    await goToPage(initialUrl);
    visitedUrls.add(initialUrl);

    for (let step = 0; step < maxSteps; step++) {
      // Observe current page state
      const pageState = await observePageState();
      if (pageState.url) visitedUrls.add(pageState.url);

      // Decide next action using AI
      const action = await decideNextAction(
        agentModel,
        task,
        pageState,
        history,
        scratchpad,
        findings,
        Array.from(visitedUrls),
        maxFindings
      );

      // Execute the action
      const result = await executeAction(action);
      history.push({ action, result });

      // Update memory
      if (action.tool === "updateScratchpad") {
        scratchpad += `\n${action.newData}`;
      } else if (action.tool === "saveFinding") {
        findings.push(action.finding);
        scratchpad += `\nFinding: ${action.finding.title} — ${action.finding.url}`;
      } else if (action.tool === "goToPage") {
        visitedUrls.add(action.url);
      }

      // Check for completion
      if (action.tool === "finishTask") {
        return {
          success: true,
          result: action.result,
          findings,
          history,
        };
      }

      // Early exit if we have enough findings
      if (findings.length >= maxFindings && performanceMode !== "thorough") {
        // Give agent one more step to finish
        if (step > 0) break;
      }
    }

    // Max steps reached
    return {
      success: false,
      error: "Max steps reached",
      findings,
      history,
    };
  } catch (error: any) {
    console.error("Web research agent error:", error);
    return {
      success: false,
      error: error.message || "Web research failed",
      findings,
      history,
      note: error.message?.includes("parse")
        ? "This model may not support structured output well. Try Claude 3.5 Sonnet or GPT-4."
        : undefined,
    };
  } finally {
    await closeBrowser();
  }
}

// Browser helper functions
async function initBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.CHROME_PATH || process.platform === "win32"
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : "/usr/bin/chromium-browser",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    currentPage = await browserInstance.newPage();
    await currentPage.setViewport({ width: 1280, height: 720 });
  }
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    currentPage = null;
  }
}

async function goToPage(url: string) {
  if (!currentPage) throw new Error("Browser not initialized");
  try {
    await currentPage.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    return { success: true, url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function observePageState() {
  if (!currentPage) throw new Error("Browser not initialized");

  const url = currentPage.url();
  const cached = pageCache.get(url);
  if (cached) return cached;

  try {
    const title = await currentPage.title();

    // Extract links
    const links = await currentPage.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors
        .slice(0, 15)
        .map((a) => ({
          text: (a as HTMLAnchorElement).textContent?.trim() || "",
          url: (a as HTMLAnchorElement).href,
        }))
        .filter((l) => l.url.startsWith("http"));
    });

    // Extract text summary
    const textContent = await currentPage.evaluate(() => {
      // Remove scripts, styles, etc.
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll("script, style, nav, footer, header")
        .forEach((el) => el.remove());
      return clone.innerText.slice(0, 2000);
    });

    const state = {
      url,
      title,
      textContent,
      links,
    };

    pageCache.set(url, state);
    return state;
  } catch (error: any) {
    return { url, title: "", textContent: "", links: [] };
  }
}

async function decideNextAction(
  model: any,
  task: string,
  pageState: any,
  history: any[],
  scratchpad: string,
  findings: Finding[],
  visitedUrls: string[],
  maxFindings: number
): Promise<Tool> {
  const recentHistory = history.slice(-6);

  const prompt = `You are an autonomous web research agent. Your goal is to: ${task}
Target: up to ${maxFindings} high-quality findings.

Current Page:
- URL: ${pageState.url}
- Title: ${pageState.title}

Available Links (top ${pageState.links?.length || 0}):
${(pageState.links || [])
  .map((l: any, i: number) => `${i + 1}. ${l.text || "(no text)"} — ${l.url}`)
  .join("\n")}

Page Content Preview:
${pageState.textContent?.slice(0, 800) || "(no content)"}

Your Notes:
${scratchpad || "(empty)"}

Findings So Far (${findings.length}/${maxFindings}):
${
  findings.map((f, i) => `${i + 1}. ${f.title} — ${f.url}`).join("\n") ||
  "(none)"
}

Visited URLs:
${visitedUrls
  .slice(-15)
  .map((u) => `- ${u}`)
  .join("\n")}

Recent Actions:
${recentHistory.map((h) => `- ${h.action.tool}`).join("\n") || "(none)"}

Guidelines:
- Use goToPage to navigate to promising links
- Use extractText to get detailed content from specific sections
- Use saveFinding for important discoveries
- Use updateScratchpad to take notes
- Use finishTask when you have sufficient findings
- Prefer authoritative sources
- Don't revisit URLs you've already seen

Return the next single action to take.`;

  try {
    const { object: action } = await generateObject({
      model,
      schema: toolSchemas,
      prompt,
      mode: "json", // Explicitly request JSON mode for better compatibility
    });

    return action;
  } catch (error: any) {
    console.error("Web research agent - generateObject error:", error);
    console.error("Model:", model);
    console.error("Error details:", error.message);

    // Fallback: If structured generation fails, finish the task
    // This prevents the agent from getting stuck
    return {
      tool: "finishTask",
      result: `Unable to continue research due to model output parsing error: ${error.message}. Please try using a different model that supports structured output better (e.g., Claude 3.5 Sonnet or GPT-4).`,
    };
  }
}

async function executeAction(action: Tool): Promise<any> {
  if (!currentPage) throw new Error("Browser not initialized");

  switch (action.tool) {
    case "goToPage":
      return goToPage(action.url);

    case "extractText": {
      try {
        const text = await currentPage.evaluate((selector) => {
          const el = selector
            ? document.querySelector(selector)
            : document.body;
          if (!el) return "";
          const clone = el.cloneNode(true) as HTMLElement;
          clone.querySelectorAll("script, style").forEach((e) => e.remove());
          return clone.innerText.slice(0, 3000);
        }, action.selector || "body");
        return { success: true, text };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    case "clickElement": {
      try {
        await currentPage.click(action.selector);
        await currentPage.waitForNavigation({ timeout: 5000 }).catch(() => {});
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    case "getLinks": {
      try {
        const links = await currentPage.evaluate((limit) => {
          const anchors = Array.from(document.querySelectorAll("a[href]"));
          return anchors
            .slice(0, limit || 20)
            .map((a) => ({
              text: (a as HTMLAnchorElement).textContent?.trim() || "",
              url: (a as HTMLAnchorElement).href,
            }))
            .filter((l) => l.url.startsWith("http"));
        }, action.limit);
        return { success: true, links };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    case "updateScratchpad":
      return { success: true };

    case "saveFinding":
      return { success: true };

    case "sleep": {
      await new Promise((resolve) => setTimeout(resolve, action.ms));
      return { success: true };
    }

    case "finishTask":
      return { success: true, result: action.result };

    default:
      throw new Error("Unknown tool");
  }
}
