// Local Intelligent Web Scraper
// Uses local Puppeteer with AI assistance for smart content extraction

import type { Browser, Page } from "puppeteer";
import { generateObject } from "ai";
import { z } from "zod";

// Global browser instance management
let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

async function getBrowserInstance(): Promise<{ browser: Browser; page: Page }> {
  const puppeteer = await import("puppeteer");

  if (!globalBrowser || !globalBrowser.isConnected()) {
    globalBrowser = await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
      ],
    });
  }

  if (!globalPage || globalPage.isClosed()) {
    globalPage = await globalBrowser.newPage();

    await globalPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    globalPage.on("error", (err) => {
      if (process.env.SCRAPER_DEBUG === "1") {
        console.debug("Local scraper page error:", err.message);
      }
    });

    globalPage.on("pageerror", (err) => {
      if (process.env.SCRAPER_DEBUG === "1") {
        console.debug("Local scraper page script error:", err.message);
      }
    });

    globalPage.on("requestfailed", (req) => {
      if (process.env.SCRAPER_DEBUG === "1") {
        console.debug("Request failed (ignored):", req.url());
      }
    });
  }

  return { browser: globalBrowser, page: globalPage };
}

// Schema for AI-powered content analysis
const ContentAnalysisSchema = z.object({
  mainContent: z
    .string()
    .describe("The main textual content of the page, cleaned and formatted"),
  title: z.string().describe("The primary title or heading of the page"),
  summary: z.string().describe("A concise summary of the page content"),
  keyPoints: z
    .array(z.string())
    .describe("Important bullet points or key information"),
  contentType: z
    .enum([
      "article",
      "product",
      "documentation",
      "news",
      "blog",
      "landing",
      "other",
    ])
    .describe("Type of content detected"),
  relevantLinks: z
    .array(
      z.object({
        url: z.string(),
        text: z.string(),
        description: z.string(),
      })
    )
    .describe("Important links found on the page with descriptions"),
  dataPoints: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        type: z.enum(["text", "number", "date", "url", "email"]),
      })
    )
    .describe("Structured data points extracted from the content"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence level in the extraction quality"),
});

type ContentAnalysis = z.infer<typeof ContentAnalysisSchema>;

export interface LocalScrapeOptions {
  url: string;
  waitForSelector?: string;
  waitTime?: number;
  extractImages?: boolean;
  extractLinks?: boolean;
  extractMetadata?: boolean;
  useAI?: boolean;
  customPrompt?: string;
  screenshot?: boolean;
  screenshotPath?: string;
  timeout?: number;
  maxScrolls?: number;
  ignoreImages?: boolean;
}

export interface LocalScrapeResult {
  success: boolean;
  url?: string;
  title?: string;
  content?: string;
  aiAnalysis?: ContentAnalysis;
  links?: Array<{ url: string; text: string }>;
  images?: Array<{ src: string; alt?: string }>;
  metadata?: {
    title: string;
    description: string;
    keywords: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    author: string;
    publishDate: string;
  };
  screenshot?: string;
  screenshotPath?: string;
  error?: string;
}

/**
 * Intelligent local web scraper using Puppeteer + AI
 */
export async function localScrape(
  options: LocalScrapeOptions
): Promise<LocalScrapeResult> {
  try {
    const { browser, page } = await getBrowserInstance();

    if (options.ignoreImages !== false) {
      page.removeAllListeners("request");

      await page.setRequestInterception(true);
      page.on("request", (req) => {
        try {
          if (req.isInterceptResolutionHandled()) {
            return;
          }

          if (
            req.resourceType() === "image" ||
            req.resourceType() === "stylesheet"
          ) {
            req.abort().catch(() => {});
          } else {
            req.continue().catch(() => {});
          }
        } catch (error: any) {
          if (process.env.SCRAPER_DEBUG === "1") {
            console.debug("Request handling error (ignored):", error.message);
          }
        }
      });
    }

    if (process.env.SCRAPER_DEBUG === "1") {
      console.log(`🌐 Navigating to: ${options.url}`);
    }
    await page.goto(options.url, {
      waitUntil: "networkidle2",
      timeout: options.timeout || 30000,
    });

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: options.timeout || 15000,
      });
    }

    if (options.waitTime) {
      await new Promise((resolve) => setTimeout(resolve, options.waitTime));
    }

    const maxScrolls = options.maxScrolls || 3;
    await smartScroll(page, maxScrolls);

    const pageInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        html: document.documentElement.outerHTML,
      };
    });

    const textContent = await page.evaluate(() => {
      const scripts = document.querySelectorAll("script, style, noscript");
      scripts.forEach((el) => el.remove());
      return document.body?.innerText || "";
    });

    const result: LocalScrapeResult = {
      success: true,
      url: pageInfo.url,
      title: pageInfo.title,
      content: textContent,
    };

    if (options.extractMetadata) {
      result.metadata = await extractMetadata(page);
    }

    if (options.extractLinks) {
      result.links = await extractLinks(page);
    }

    if (options.extractImages) {
      result.images = await extractImages(page);
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      error: `Local scrape failed: ${error.message}`,
    };
  }
}

async function smartScroll(page: Page, maxScrolls: number = 3): Promise<void> {
  try {
    let previousHeight = await page.evaluate(() => document.body.scrollHeight);

    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === previousHeight) {
        break;
      }
      previousHeight = newHeight;
    }

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error: any) {
    if (process.env.SCRAPER_DEBUG === "1") {
      console.debug("Smart scroll error (ignored):", error.message);
    }
  }
}

async function extractMetadata(
  page: Page
): Promise<LocalScrapeResult["metadata"]> {
  return await page.evaluate(() => {
    const getMetaContent = (selector: string): string => {
      const element = document.querySelector(selector);
      return element?.getAttribute("content") || "";
    };

    return {
      title: document.title,
      description: getMetaContent('meta[name="description"]'),
      keywords: getMetaContent('meta[name="keywords"]'),
      ogTitle: getMetaContent('meta[property="og:title"]'),
      ogDescription: getMetaContent('meta[property="og:description"]'),
      ogImage: getMetaContent('meta[property="og:image"]'),
      author: getMetaContent('meta[name="author"]'),
      publishDate:
        getMetaContent('meta[property="article:published_time"]') ||
        getMetaContent('meta[name="date"]'),
    };
  });
}

async function extractLinks(
  page: Page
): Promise<Array<{ url: string; text: string }>> {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a[href]"));
    return links
      .map((link) => ({
        url: (link as HTMLAnchorElement).href,
        text: link.textContent?.trim() || "",
      }))
      .filter((link) => link.url && link.text)
      .slice(0, 50);
  });
}

async function extractImages(
  page: Page
): Promise<Array<{ src: string; alt?: string }>> {
  return await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll("img[src]"));
    return images
      .map((img) => ({
        src: (img as HTMLImageElement).src,
        alt: (img as HTMLImageElement).alt,
      }))
      .filter((img) => img.src)
      .slice(0, 20);
  });
}

export async function cleanupLocalScraper(): Promise<void> {
  try {
    if (globalPage && !globalPage.isClosed()) {
      await globalPage.close();
      globalPage = null;
    }
    if (globalBrowser && globalBrowser.isConnected()) {
      await globalBrowser.close();
      globalBrowser = null;
    }
  } catch (error: any) {
    if (process.env.SCRAPER_DEBUG === "1") {
      console.debug("Local scraper cleanup error (ignored):", error.message);
    }
  }
}


export async function quickExtractText(
  url: string,
  timeout: number = 15000
): Promise<{
  success: boolean;
  text?: string;
  title?: string;
  error?: string;
}> {
  try {
    const result = await localScrape({
      url,
      timeout,
      useAI: false,
      extractImages: false,
      extractLinks: false,
      extractMetadata: false,
      ignoreImages: true,
      maxScrolls: 1,
    });

    return {
      success: result.success,
      text: result.content,
      title: result.title,
      error: result.error,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Quick extraction failed: ${error.message}`,
    };
  }
}
