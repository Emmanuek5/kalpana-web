/**
 * Browser automation utilities for web research agent
 * Uses Puppeteer for browser control
 */

import type { Browser, Page } from "puppeteer";

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
  }

  return { browser: globalBrowser, page: globalPage };
}

export async function goToPage(options: {
  url: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  timeout?: number;
}): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { page } = await getBrowserInstance();
    await page.goto(options.url, {
      waitUntil: options.waitUntil || "domcontentloaded",
      timeout: options.timeout || 30000,
    });
    return { success: true, url: page.url() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPageInfo(): Promise<{
  success: boolean;
  url?: string;
  title?: string;
  error?: string;
}> {
  try {
    const { page } = await getBrowserInstance();
    const url = page.url();
    const title = await page.title();
    return { success: true, url, title };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAllElements(options: {
  selector: string;
  attribute?: string;
  getText?: boolean;
  waitForSelector?: boolean;
  timeout?: number;
}): Promise<{
  success: boolean;
  elements?: Array<{ text?: string; attribute?: string }>;
  error?: string;
}> {
  try {
    const { page } = await getBrowserInstance();

    if (options.waitForSelector !== false) {
      await page.waitForSelector(options.selector, {
        timeout: options.timeout || 5000,
      }).catch(() => {});
    }

    const elements = await page.evaluate(
      (sel, attr, getText) => {
        const els = Array.from(document.querySelectorAll(sel));
        return els.map((el) => ({
          text: getText ? el.textContent?.trim() || "" : undefined,
          attribute: attr ? el.getAttribute(attr) || "" : undefined,
        }));
      },
      options.selector,
      options.attribute,
      options.getText
    );

    return { success: true, elements };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function clickElement(options: {
  selector: string;
  timeout?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { page } = await getBrowserInstance();
    await page.waitForSelector(options.selector, {
      timeout: options.timeout || 5000,
    });
    await page.click(options.selector);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function typeText(options: {
  selector: string;
  text: string;
  timeout?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { page } = await getBrowserInstance();
    await page.waitForSelector(options.selector, {
      timeout: options.timeout || 5000,
    });
    await page.type(options.selector, options.text);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getText(options: {
  selector: string;
  timeout?: number;
}): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const { page } = await getBrowserInstance();
    await page.waitForSelector(options.selector, {
      timeout: options.timeout || 5000,
    });
    const text = await page.$eval(options.selector, (el) => el.textContent?.trim() || "");
    return { success: true, text };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAttribute(options: {
  selector: string;
  attribute: string;
  timeout?: number;
}): Promise<{ success: boolean; value?: string; error?: string }> {
  try {
    const { page } = await getBrowserInstance();
    await page.waitForSelector(options.selector, {
      timeout: options.timeout || 5000,
    });
    const value = await page.$eval(
      options.selector,
      (el, attr) => el.getAttribute(attr) || "",
      options.attribute
    );
    return { success: true, value };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function scrollTo(options: {
  selector: string;
  timeout?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { page } = await getBrowserInstance();
    await page.waitForSelector(options.selector, {
      timeout: options.timeout || 5000,
    });
    await page.$eval(options.selector, (el) => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function closeBrowser(): Promise<void> {
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
    console.error("Browser cleanup error:", error.message);
  }
}
