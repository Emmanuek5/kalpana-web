import { z } from "zod";
import { generateObject } from "ai";
import * as browser from "./browser";
import * as scraper from "../local-scraper";

// Simple page cache to avoid re-scraping the same URL repeatedly
const pageCache = new Map<string, any>();

// Define a structured finding format for the agent's research
type Finding = {
  title: string;
  url: string;
  summary?: string;
  source?: string;
};

// Define the schema for the tools that the agent can use
const toolSchemas = z.union([
  z.object({
    tool: z.literal("goToPage"),
    url: z.string().url(),
  }),
  z.object({
    tool: z.literal("clickElement"),
    selector: z.string().describe("CSS selector for the element to click"),
  }),
  z.object({
    tool: z.literal("typeText"),
    selector: z.string().describe("CSS selector for the input element"),
    text: z.string(),
  }),
  z.object({
    tool: z.literal("updateScratchpad"),
    newData: z
      .string()
      .describe("New information to add to the agent's scratchpad."),
  }),
  z.object({
    tool: z.literal("saveFinding"),
    finding: z
      .object({
        title: z.string().min(1),
        url: z.string().url(),
        summary: z.string().optional(),
        source: z.string().optional(),
      })
      .describe("Structured research finding to persist in memory"),
  }),
  z.object({
    tool: z.literal("getText"),
    selector: z
      .string()
      .describe("CSS selector for the element to get text from"),
  }),
  z.object({
    tool: z.literal("getAttribute"),
    selector: z.string().describe("CSS selector for the element"),
    attribute: z.string().describe("The attribute to get from the element"),
  }),
  z.object({
    tool: z.literal("scrollTo"),
    selector: z.string().describe("CSS selector for the element to scroll to"),
  }),
  z.object({
    tool: z.literal("sleep"),
    ms: z.number().int().min(50).max(5000).describe("Milliseconds to pause"),
  }),
  z.object({
    tool: z.literal("finishTask"),
    result: z.string().describe("The final result or summary of the task"),
  }),
]);

type Tool = z.infer<typeof toolSchemas>;

export interface WebResearchAgentOptions {
  task: string;
  startUrl?: string;
  maxSteps?: number;
  performanceMode?: "fast" | "balanced" | "thorough";
  aiEveryNSteps?: number;
  maxFindings?: number;
  maxLinksPerStep?: number;
  model: any; // Required: Language model from main agent (uses user's API key)
}

export async function runWebResearchAgent(options: WebResearchAgentOptions) {
  const {
    task,
    startUrl,
    maxSteps = 20,
    performanceMode = "fast",
    aiEveryNSteps,
    maxFindings = 10,
    maxLinksPerStep,
    model,
  } = options;

  // Model must be provided from the main agent to use user's API key
  if (!model) {
    throw new Error("Model is required for web research agent");
  }

  const resolvedAiEvery = Math.max(
    1,
    aiEveryNSteps ??
      (performanceMode === "thorough"
        ? 1
        : performanceMode === "balanced"
        ? 3
        : 5)
  );
  const resolvedMaxLinks =
    maxLinksPerStep ??
    (performanceMode === "thorough"
      ? 25
      : performanceMode === "balanced"
      ? 15
      : 10);

  pageCache.clear();
  let scratchpad = "";
  const findings: Finding[] = [];
  const visitedUrls = new Set<string>();
  const history: Array<{ action: Tool; result: any }> = [];

  try {
    // 1. Navigate to the starting URL or a search engine (faster waitUntil/timeout)
    const initialUrl =
      startUrl || `https://www.google.com/search?q=${encodeURIComponent(task)}`;
    await browser.goToPage({
      url: initialUrl,
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    for (let i = 0; i < maxSteps; i++) {
      const stepNumber = i + 1;
      const isAiStep =
        performanceMode === "thorough" || stepNumber % resolvedAiEvery === 0;

      // 2. Observe the current state of the page (fast path with optional AI)
      const pageState = await observePageState({
        maxLinks: resolvedMaxLinks,
        aiStep: isAiStep,
        fast: performanceMode === "fast",
      });
      if (pageState.url) visitedUrls.add(pageState.url);

      // 3. Decide the next action using the AI model (with user's API key)
      const action = await decideNextAction(
        model, // Use the model passed from main agent
        task,
        pageState,
        history,
        scratchpad,
        findings,
        Array.from(visitedUrls),
        maxFindings
      );

      // 4. Execute the action
      const result = await executeAction(action);
      history.push({ action, result });

      // 4b. Maintain memory/state
      if (action.tool === "updateScratchpad") {
        scratchpad += `\n${action.newData}`;
      } else if (action.tool === "saveFinding") {
        findings.push(action.finding);
        scratchpad += `\nFinding: ${action.finding.title} — ${action.finding.url}`;
      }

      if (action.tool === "goToPage") {
        visitedUrls.add(action.url);
      }

      // Early exit if we reached target findings and agent chooses to stop soon
      if (findings.length >= maxFindings && performanceMode !== "thorough") {
        // Give the agent one more chance next loop to produce finishTask
      }

      // 5. Check for task completion
      if (action.tool === "finishTask") {
        return {
          success: true,
          result: action.result,
          findings,
          history,
        };
      }
    }

    return { success: false, error: "Max steps reached", findings, history };
  } catch (error: any) {
    console.error("Web research agent error:", error);
    return { 
      success: false, 
      error: error.message || "Web research failed", 
      findings, 
      history 
    };
  } finally {
    await browser.closeBrowser();
  }
}

async function observePageState(opts: {
  fast: boolean;
  aiStep: boolean;
  maxLinks: number;
}) {
  const pageInfo = await browser.getPageInfo();
  if (!pageInfo.success || !pageInfo.url) {
    throw new Error(`Failed to get page info: ${pageInfo.error}`);
  }

  const cached = pageCache.get(pageInfo.url);
  if (cached) return cached;

  // Fast-link extraction via browser, avoid heavy scraping each step
  const linksResult = await browser
    .getAllElements({
      selector: "a[href]",
      attribute: "href",
      getText: true,
      waitForSelector: false,
      timeout: 2000,
    })
    .catch(() => ({ success: false } as any));

  const links = Array.isArray(linksResult?.elements)
    ? linksResult.elements
        .map((el: any) => ({ text: el.text || "", url: el.attribute }))
        .filter(
          (l: any) => typeof l.url === "string" && l.url.startsWith("http")
        )
        .slice(0, opts.maxLinks)
    : [];

  // Very fast text extraction; reserve AI analysis for aiStep
  let analysis: any = {};
  if (opts.aiStep) {
    const scraped = await scraper
      .localScrape({
        url: pageInfo.url,
        useAI: true,
        extractLinks: false,
        extractMetadata: false,
        ignoreImages: true,
        maxScrolls: 1,
        timeout: 20000,
      })
      .catch(() => ({ success: false } as any));
    if (scraped?.success) {
      analysis = scraped.aiAnalysis || {
        summary: scraped.content?.slice(0, 1200),
      };
    }
  } else {
    const quick = await scraper
      .quickExtractText(pageInfo.url, 12000)
      .catch(() => ({ success: false } as any));
    if (quick?.success) {
      analysis = { summary: quick.text?.slice(0, 1200) };
    }
  }

  const state = {
    url: pageInfo.url,
    title: pageInfo.title,
    analysis,
    links,
  } as const;

  pageCache.set(pageInfo.url, state);
  return state;
}

async function decideNextAction(
  model: any, // Model from main agent with user's API key
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
Target results: up to ${maxFindings} high-quality items.

Current State:
- URL: ${pageState.url}
- Title: ${pageState.title}

Outgoing links (first ${pageState.links?.length ?? 0}):
${(pageState.links || [])
  .map((l: any, i: number) => `${i + 1}. ${l.text || "(no text)"} — ${l.url}`)
  .join("\n")}

Scratchpad:
${(scratchpad || "(empty)").slice(0, 1500)}

Findings (${findings.length}/${maxFindings}):
${findings
  .map((f, i) => `${i + 1}. ${f.title} — ${f.url}`)
  .slice(0, 15)
  .join("\n")}

Visited URLs:
${visitedUrls
  .slice(-20)
  .map((u) => `- ${u}`)
  .join("\n")}

Guidelines:
- Prefer authoritative sources; avoid spam.
- Do not revisit visited URLs.
- Save strong evidence with saveFinding { title, url, summary }.
- Use updateScratchpad for raw notes.
- Navigate using goToPage with a listed link when appropriate.
- Use sleep 100-800ms if a page is dynamic before scraping again.
- When you have enough to answer, finishTask with a concise answer and sources.

History (recent steps):
${recentHistory.map((h) => `- ${h.action.tool}`).join("\n")}

Return the next single action.`;

  try {
    const { object: action } = await generateObject({
      model,
      schema: toolSchemas,
      prompt,
    });

    return action;
  } catch (error: any) {
    console.error("Web research agent - generateObject error:", error);
    
    // Fallback: finish the task if parsing fails
    return {
      tool: "finishTask",
      result: `Research incomplete due to parsing error. Findings so far: ${findings.map(f => `${f.title} (${f.url})`).join(", ")}`,
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeAction(action: Tool): Promise<any> {
  switch (action.tool) {
    case "goToPage":
      return browser.goToPage({
        url: action.url,
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
    case "clickElement":
      return browser.clickElement({ selector: action.selector });
    case "typeText":
      return browser.typeText({
        selector: action.selector,
        text: action.text,
      });
    case "updateScratchpad":
      return { success: true };
    case "saveFinding":
      return { success: true };
    case "getText":
      return browser.getText({ selector: action.selector });
    case "getAttribute":
      return browser.getAttribute({
        selector: action.selector,
        attribute: action.attribute,
      });
    case "scrollTo":
      return browser.scrollTo({ selector: action.selector });
    case "sleep":
      await delay(action.ms);
      return { success: true };
    case "finishTask":
      return { success: true, result: action.result };
    default:
      throw new Error("Unknown tool");
  }
}