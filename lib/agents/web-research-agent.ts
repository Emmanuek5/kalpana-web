import { z } from "zod";
import { generateObject, generateText } from "ai";
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

// Schema for the research plan
const researchPlanSchema = z.object({
  strategy: z.string().describe("Overall research strategy and approach"),
  searchQueries: z.array(z.object({
    query: z.string().describe("Search query to use"),
    searchEngine: z.enum(["google", "bing", "duckduckgo"]).default("google"),
    purpose: z.string().describe("What this search aims to find"),
    priority: z.enum(["high", "medium", "low"]),
  })).describe("List of search queries to perform"),
  targetDomains: z.array(z.string()).optional().describe("Preferred domains if any (e.g., .edu, .gov, wikipedia.org)"),
  dataExtractionApproach: z.object({
    primaryTools: z.array(z.enum([
      "getText",
      "getAttribute",
      "getAllElements",
      "extractSearchResults",
      "clickElement",
      "typeText",
      "scrollTo"
    ])).describe("Primary tools to use for data extraction"),
    extractionStrategy: z.string().describe("How to extract the needed information"),
    contentSelectors: z.array(z.string()).optional().describe("CSS selectors to target for content"),
  }),
  expectedFindings: z.number().int().min(1).max(20).describe("Expected number of quality findings"),
  estimatedSteps: z.number().int().min(5).max(50).describe("Estimated steps needed"),
  researchDepth: z.enum(["broad", "focused", "deep"]).describe("Whether to cast a wide net or dig deep into fewer sources"),
});

type ResearchPlan = z.infer<typeof researchPlanSchema>;

// Define the schema for the tools that the agent can use
const toolSchemas = z.union([
  z.object({
    tool: z.literal("performSearch"),
    query: z.string().describe("Search query"),
    searchEngine: z.enum(["google", "bing", "duckduckgo"]).optional(),
  }),
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
    tool: z.literal("getAllElements"),
    selector: z.string().describe("CSS selector for elements to extract"),
    extractText: z.boolean().optional().describe("Whether to extract text content"),
    extractAttribute: z.string().optional().describe("Attribute to extract from elements"),
  }),
  z.object({
    tool: z.literal("extractSearchResults"),
    maxResults: z.number().int().min(3).max(20).optional().describe("Maximum search results to extract"),
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
    tool: z.literal("replan"),
    reason: z.string().describe("Why replanning is needed"),
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
  maxFindings?: number;
  model: any; // Required: Language model from main agent (uses user's API key)
}

export async function runWebResearchAgent(options: WebResearchAgentOptions) {
  const {
    task,
    startUrl,
    maxSteps = 35,
    performanceMode = "balanced",
    maxFindings = 10,
    model,
  } = options;

  // Model must be provided from the main agent to use user's API key
  if (!model) {
    throw new Error("Model is required for web research agent");
  }

  pageCache.clear();
  let scratchpad = "";
  const findings: Finding[] = [];
  const visitedUrls = new Set<string>();
  const completedSearches = new Set<string>();
  const history: Array<{ action: Tool; result: any }> = [];

  try {
    // PHASE 1: Planning - Let the model decide the research strategy
    console.log("🧠 Planning research strategy...");
    const plan = await createResearchPlan(model, task, startUrl, maxFindings, performanceMode);
    
    scratchpad += `Research Plan:\n${plan.strategy}\n\nSearch Queries: ${plan.searchQueries.map(q => q.query).join(", ")}\n`;
    
    console.log("📋 Plan created:");
    console.log(`  Strategy: ${plan.strategy}`);
    console.log(`  Search queries: ${plan.searchQueries.length}`);
    console.log(`  Research depth: ${plan.researchDepth}`);
    console.log(`  Expected findings: ${plan.expectedFindings}`);

    // PHASE 2: Execution - Follow the plan with dynamic adjustments
    let currentPlan = plan;
    let currentSearchIndex = 0;
    let replansUsed = 0;
    const maxReplans = 2;

    for (let i = 0; i < maxSteps; i++) {
      const stepNumber = i + 1;

      // Check if we should execute a planned search
      if (currentSearchIndex < currentPlan.searchQueries.length) {
        const plannedSearch = currentPlan.searchQueries[currentSearchIndex];
        const searchKey = `${plannedSearch.searchEngine}:${plannedSearch.query}`;
        
        if (!completedSearches.has(searchKey) && stepNumber % 3 === 1) {
          console.log(`🔍 Executing planned search: "${plannedSearch.query}" (${plannedSearch.purpose})`);
          
          await performSearch(plannedSearch.query, plannedSearch.searchEngine);
          completedSearches.add(searchKey);
          currentSearchIndex++;
          
          // Give the page time to load
          await delay(1000);
        }
      }

      // Observe the current state
      const pageState = await observePageState({
        maxLinks: performanceMode === "thorough" ? 30 : performanceMode === "balanced" ? 20 : 15,
        aiStep: stepNumber % 2 === 0, // Do AI analysis every other step
        fast: performanceMode === "fast",
      });
      
      if (pageState.url) visitedUrls.add(pageState.url);

      // Decide next action based on plan and current state
      const action = await decideNextActionWithPlan(
        model,
        task,
        currentPlan,
        pageState,
        history,
        scratchpad,
        findings,
        Array.from(visitedUrls),
        Array.from(completedSearches),
        maxFindings,
        currentSearchIndex
      );

      // Execute the action
      const result = await executeAction(action);
      history.push({ action, result });

      // Log important actions
      if (action.tool === "performSearch") {
        console.log(`🔍 New search: "${action.query}"`);
      } else if (action.tool === "goToPage") {
        console.log(`🌐 Navigating to: ${action.url}`);
      } else if (action.tool === "extractSearchResults") {
        console.log(`📊 Extracting search results...`);
      }

      // Maintain memory/state
      if (action.tool === "updateScratchpad") {
        scratchpad += `\n${action.newData}`;
      } else if (action.tool === "saveFinding") {
        findings.push(action.finding);
        scratchpad += `\n[Finding ${findings.length}] ${action.finding.title} — ${action.finding.url}`;
        console.log(`✅ Finding #${findings.length}: ${action.finding.title}`);
      } else if (action.tool === "performSearch") {
        const searchKey = `${action.searchEngine || "google"}:${action.query}`;
        completedSearches.add(searchKey);
      } else if (action.tool === "goToPage") {
        visitedUrls.add(action.url);
      } else if (action.tool === "replan") {
        // Replan if needed
        if (replansUsed < maxReplans) {
          console.log(`🔄 Replanning... Reason: ${action.reason}`);
          currentPlan = await createResearchPlan(
            model,
            task,
            pageState.url,
            maxFindings,
            performanceMode,
            { previousPlan: currentPlan, findings, scratchpad, completedSearches: Array.from(completedSearches) }
          );
          replansUsed++;
          currentSearchIndex = 0;
          scratchpad += `\n[REPLANNED: ${action.reason}]`;
        } else {
          console.log("⚠️ Max replans reached, continuing with current plan");
        }
      }

      // Check for task completion
      if (action.tool === "finishTask") {
        console.log("🎯 Task completed!");
        return {
          success: true,
          result: action.result,
          findings,
          history,
          plan: currentPlan,
        };
      }

      // Auto-finish if we have enough findings and completed most searches
      if (findings.length >= maxFindings && completedSearches.size >= currentPlan.searchQueries.length) {
        console.log("✅ Target findings reached and searches completed");
        return {
          success: true,
          result: `Research completed with ${findings.length} findings from ${completedSearches.size} searches.`,
          findings,
          history,
          plan: currentPlan,
        };
      }
    }

    return { 
      success: false, 
      error: "Max steps reached", 
      findings, 
      history,
      plan: currentPlan 
    };
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

async function createResearchPlan(
  model: any,
  task: string,
  startUrl: string | undefined,
  maxFindings: number = 10,
  performanceMode: string = "balanced",
  context?: {
    previousPlan?: ResearchPlan;
    findings?: Finding[];
    scratchpad?: string;
    completedSearches?: string[];
  }
): Promise<ResearchPlan> {
  const contextInfo = context ? `
Previous Research Context:
${context.previousPlan ? `Previous Strategy: ${context.previousPlan.strategy}` : ""}
${context.completedSearches ? `Completed Searches: ${context.completedSearches.join(", ")}` : ""}
${context.findings ? `Findings so far (${context.findings.length}): ${context.findings.slice(0, 5).map(f => f.title).join(", ")}` : ""}
${context.scratchpad ? `Recent Notes: ${context.scratchpad.slice(-600)}` : ""}

Learn from what worked and what didn't. Adjust your approach accordingly.
` : "";

  const prompt = `You are a strategic web research planner. Create a comprehensive research plan for:

TASK: ${task}
${startUrl ? `Starting Point: ${startUrl}` : ""}
Target: ${maxFindings} high-quality findings
Mode: ${performanceMode}

${contextInfo}

Your plan should be thorough and methodical:

1. SEARCH STRATEGY:
   - Start with broad Google/Bing searches to find authoritative sources
   - Use multiple search queries with different angles (3-6 queries)
   - Include specific domain preferences if relevant (e.g., .edu, .gov, wikipedia.org)
   - Consider different search engines for different purposes

2. DATA EXTRACTION:
   - Identify which tools will be most effective
   - Specify CSS selectors for common content patterns (articles, lists, tables)
   - Plan for both search result extraction AND deep content analysis

3. RESEARCH DEPTH:
   - "broad": Cast a wide net, many searches, skim multiple sources
   - "focused": Targeted searches, moderate depth per source
   - "deep": Fewer searches, thorough analysis of each source

Create a plan that balances efficiency with thoroughness. Prioritize searches that will yield the most relevant results.`;

  try {
    const { object: plan } = await generateObject({
      model,
      schema: researchPlanSchema,
      schemaName: "ResearchPlan",
      schemaDescription: "A comprehensive plan for systematic web research",
      prompt,
      mode: "json",
    });

    return plan;
  } catch (error: any) {
    console.error("Planning error:", error);
    // Fallback plan with generic Google search
    return {
      strategy: "Perform broad Google searches and extract top results",
      searchQueries: [
        {
          query: task,
          searchEngine: "google" as const,
          purpose: "General search for the main topic",
          priority: "high" as const,
        },
        {
          query: `${task} guide`,
          searchEngine: "google" as const,
          purpose: "Find comprehensive guides",
          priority: "medium" as const,
        },
      ],
      targetDomains: [],
      dataExtractionApproach: {
        primaryTools: ["getText", "getAllElements", "extractSearchResults"],
        extractionStrategy: "Extract search results first, then visit top results for detailed content",
        contentSelectors: ["article", "main", ".content", "#content"],
      },
      expectedFindings: maxFindings,
      estimatedSteps: 20,
      researchDepth: "broad" as const,
    };
  }
}

async function performSearch(query: string, searchEngine: string = "google"): Promise<void> {
  const searchUrls = {
    google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  };

  const url = searchUrls[searchEngine as keyof typeof searchUrls] || searchUrls.google;
  
  await browser.goToPage({
    url,
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
}

async function observePageState(opts: {
  fast: boolean;
  aiStep: boolean;
  maxLinks: number;
}) {
  const pageInfo = await browser.getPageInfo().catch((err) => ({
    success: false as const,
    url: undefined,
    title: undefined,
    error: err.message || "Timeout getting page info",
  }));
  
  if (!pageInfo.success || !pageInfo.url) {
    console.warn(`⚠️ Failed to get page info: ${pageInfo.error || "Unknown error"}`);
    return {
      url: "about:blank",
      title: "Page unavailable",
      analysis: { summary: "Page timed out or failed to load" },
      links: [],
      isSearchResultsPage: false,
    };
  }

  const cached = pageCache.get(pageInfo.url as string);
  if (cached) return cached;

  const url = pageInfo.url as string;
  const title = pageInfo.title as string;
  
  // Detect if this is a search results page
  const isSearchResultsPage = url.includes("google.com/search") || 
                               url.includes("bing.com/search") || 
                               url.includes("duckduckgo.com");

  // Extract links with more context
  const linksResult = await browser
    .getAllElements({
      selector: "a[href]",
      attribute: "href",
      getText: true,
      waitForSelector: false,
      timeout: 3000,
    })
    .catch((err) => {
      console.warn(`⚠️ Failed to get links: ${err.message}`);
      return { success: false } as any;
    });

  const links = Array.isArray(linksResult?.elements)
    ? linksResult.elements
        .map((el: any) => ({ text: el.text || "", url: el.attribute }))
        .filter(
          (l: any) => typeof l.url === "string" && l.url.startsWith("http")
        )
        .slice(0, opts.maxLinks)
    : [];

  let analysis: any = {};
  if (opts.aiStep) {
    const scraped = await scraper
      .localScrape({
        url,
        useAI: true,
        extractLinks: false,
        extractMetadata: true,
        ignoreImages: true,
        maxScrolls: isSearchResultsPage ? 0 : 1,
        timeout: 20000,
      })
      .catch((err) => {
        console.warn(`⚠️ Scraping failed: ${err.message}`);
        return { success: false } as any;
      });
    if (scraped?.success) {
      analysis = scraped.aiAnalysis || {
        summary: scraped.content?.slice(0, 1500),
      };
    }
  } else {
    const quick = await scraper
      .quickExtractText(url, 15000)
      .catch((err) => {
        console.warn(`⚠️ Quick extract failed: ${err.message}`);
        return { success: false } as any;
      });
    if (quick?.success) {
      analysis = { summary: quick.text?.slice(0, 1500) };
    }
  }

  const state = {
    url,
    title,
    analysis,
    links,
    isSearchResultsPage,
  } as const;

  pageCache.set(url, state);
  return state;
}

async function decideNextActionWithPlan(
  model: any,
  task: string,
  plan: ResearchPlan,
  pageState: any,
  history: any[],
  scratchpad: string,
  findings: Finding[],
  visitedUrls: string[],
  completedSearches: string[],
  maxFindings: number,
  currentSearchIndex: number
): Promise<Tool> {
  const recentHistory = history.slice(-6);
  const remainingSearches = plan.searchQueries.slice(currentSearchIndex);
  const progress = Math.round((findings.length / maxFindings) * 100);

  const prompt = `You are a systematic web research agent executing a research plan.

TASK: ${task}

RESEARCH PLAN:
Strategy: ${plan.strategy}
Research Depth: ${plan.researchDepth}
Extraction Strategy: ${plan.dataExtractionApproach.extractionStrategy}
Recommended Tools: ${plan.dataExtractionApproach.primaryTools.join(", ")}
${plan.targetDomains?.length ? `Preferred Domains: ${plan.targetDomains.join(", ")}` : ""}

REMAINING SEARCHES (${remainingSearches.length}):
${remainingSearches.map((s, i) => `${i + 1}. "${s.query}" - ${s.purpose} [${s.priority}]`).join("\n")}

COMPLETED SEARCHES (${completedSearches.length}):
${completedSearches.slice(-5).join(", ")}

CURRENT PAGE:
URL: ${pageState.url}
Title: ${pageState.title}
Type: ${pageState.isSearchResultsPage ? "SEARCH RESULTS PAGE" : "Content Page"}
Summary: ${pageState.analysis?.summary?.slice(0, 400) || "N/A"}

AVAILABLE LINKS (showing top 10 of ${pageState.links?.length ?? 0}):
${(pageState.links || [])
  .slice(0, 10)
  .map((l: any, i: number) => `${i + 1}. ${l.text?.slice(0, 80) || "(no text)"} — ${l.url}`)
  .join("\n")}

PROGRESS: ${progress}% (${findings.length}/${maxFindings} findings)

RECENT FINDINGS:
${findings
  .slice(-4)
  .map((f, i) => `${findings.length - 3 + i}. ${f.title}`)
  .join("\n") || "(none yet)"}

RESEARCH NOTES (recent):
${(scratchpad || "(empty)").slice(-1000)}

RECENT ACTIONS:
${recentHistory.map((h, i) => `${i + 1}. ${h.action.tool}${h.action.tool === "performSearch" ? ` - "${(h.action as any).query}"` : ""}`).join("\n")}

YOUR SYSTEMATIC APPROACH:
1. If on a search results page: Use "extractSearchResults" to get top results, then "goToPage" to promising ones
2. If on a content page: Extract valuable info with "getText", "getAllElements", or custom selectors
3. Save quality findings with "saveFinding" when you find relevant information
4. Perform next planned search with "performSearch" when appropriate
5. Use "updateScratchpad" to track patterns, dead ends, and insights
6. Navigate to promising links from search results with "goToPage"
7. Call "finishTask" when you have sufficient high-quality findings

CRITICAL RULES:
- Always extract search results before leaving a search page
- Visit the most authoritative/relevant links from search results
- Don't revisit URLs in: ${visitedUrls.slice(-10).join(", ")}
- Prefer ${plan.targetDomains?.join(", ") || "authoritative domains"}
- Balance breadth (many sources) with depth (thorough extraction)
- Call "replan" if searches aren't yielding good results

Choose your next action strategically:`;

  try {
    const { object: action } = await generateObject({
      model,
      schema: toolSchemas,
      schemaName: "WebResearchAction",
      schemaDescription: "Next systematic research action following the plan",
      prompt,
      mode: "json",
    });

    return action;
  } catch (error: any) {
    console.error("Action decision error:", error);
    
    return {
      tool: "finishTask",
      result: `Research incomplete due to error. Collected ${findings.length} findings from ${completedSearches.length} searches.`,
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeAction(action: Tool): Promise<any> {
  switch (action.tool) {
    case "performSearch":
      await performSearch(action.query, action.searchEngine);
      return { success: true, query: action.query };
      
    case "extractSearchResults":
      // Extract search results based on common patterns
      const maxResults = (action as any).maxResults || 10;
      const results = await browser.getAllElements({
        selector: "div.g, li.b_algo, article[data-result]", // Google, Bing, DuckDuckGo
        getText: true,
        timeout: 3000,
      }).catch(() => ({ success: false, elements: [] }));
      
      return { 
        success: true, 
        count: Array.isArray(results.elements) ? Math.min(results.elements.length, maxResults) : 0 
      };
      
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
      
    case "getAllElements":
      return browser.getAllElements({
        selector: action.selector,
        getText: action.extractText,
        attribute: action.extractAttribute,
      });
      
    case "scrollTo":
      return browser.scrollTo({ selector: action.selector });
      
    case "sleep":
      await delay(action.ms);
      return { success: true };
      
    case "replan":
      return { success: true, reason: action.reason };
      
    case "finishTask":
      return { success: true, result: action.result };
      
    default:
      throw new Error("Unknown tool");
  }
}