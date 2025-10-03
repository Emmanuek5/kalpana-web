/**
 * Browser automation utilities for web research agent
 * Uses Puppeteer for browser control - OPTIMIZED FOR SPEED
 */

import type { Browser, Page } from "puppeteer";

let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

async function getBrowserInstance(): Promise<{ browser: Browser; page: Page }> {
  const puppeteer = await import("puppeteer");

  if (!globalBrowser || !globalBrowser.isConnected()) {
    globalBrowser = await puppeteer.default.launch({
      headless: true, // Changed to true for better performance
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        // Performance optimizations
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--mute-audio',
        // Memory optimizations
        '--disable-default-apps',
        '--disable-sync',
        '--disable-hang-monitor',
        // Speed optimizations
        '--dns-prefetch-disable',
        '--enable-fast-unload',
        '--window-size=1920,1080',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      // Increase protocol timeout to handle slow operations
      protocolTimeout: 30000,
    });
  }

  if (!globalPage || globalPage.isClosed()) {
    globalPage = await globalBrowser.newPage();
    
    // Set user agent
    await globalPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Block unnecessary resources for speed
    await globalPage.setRequestInterception(true);
    globalPage.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url();
      
      // Block images, stylesheets, fonts, and media for faster loading
      if (
        resourceType === 'image' || 
        resourceType === 'stylesheet' ||
        resourceType === 'font' ||
        resourceType === 'media' ||
        // Block known ad/tracker domains
        url.includes('doubleclick.net') ||
        url.includes('googlesyndication.com') ||
        url.includes('google-analytics.com') ||
        url.includes('googletagmanager.com') ||
        url.includes('facebook.com/tr') ||
        url.includes('connect.facebook.net')
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Set faster timeouts
    await globalPage.setDefaultTimeout(10000);
    await globalPage.setDefaultNavigationTimeout(15000);

    // Disable JavaScript on pages that don't need it (can be enabled per-page)
    // await globalPage.setJavaScriptEnabled(false);
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
    
    // Use domcontentloaded by default for speed
    await page.goto(options.url, {
      waitUntil: options.waitUntil || "domcontentloaded",
      timeout: options.timeout || 15000,
    });
    
    // Wait a bit for dynamic content
    await page.waitForTimeout(500);
    
    return { success: true, url: page.url() };
  } catch (error: any) {
    console.error(`Navigation error: ${error.message}`);
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
    
    // Use Promise.race to avoid hanging
    const result = await Promise.race([
      Promise.all([
        page.url(),
        page.title(),
      ]),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Page info timeout")), 3000)
      )
    ]);
    
    const [url, title] = result;
    return { success: true, url, title };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCurrentUrl(): Promise<string> {
  try {
    const { page } = await getBrowserInstance();
    return page.url();
  } catch (error: any) {
    return "about:blank";
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
        timeout: options.timeout || 3000,
      }).catch(() => {
        // Selector not found, continue anyway
      });
    }

    // Use evaluate with timeout
    const elements = await Promise.race([
      page.evaluate(
        (sel, attr, getText) => {
          const els = Array.from(document.querySelectorAll(sel));
          return els.slice(0, 100).map((el) => ({ // Limit to 100 elements
            text: getText ? el.textContent?.trim().slice(0, 200) || "" : undefined,
            attribute: attr ? el.getAttribute(attr) || "" : undefined,
          }));
        },
        options.selector,
        options.attribute,
        options.getText
      ),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Evaluate timeout")), 3000)
      )
    ]);

    return { success: true, elements };
  } catch (error: any) {
    return { success: false, error: error.message, elements: [] };
  }
}

export async function clickElement(options: {
  selector: string;
  timeout?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { page } = await getBrowserInstance();
    await page.waitForSelector(options.selector, {
      timeout: options.timeout || 3000,
    });
    await page.click(options.selector);
    await page.waitForTimeout(500); // Wait for click to take effect
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
      timeout: options.timeout || 3000,
    });
    await page.type(options.selector, options.text, { delay: 50 });
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
      timeout: options.timeout || 3000,
    }).catch(() => {});
    
    const text = await page.$eval(
      options.selector, 
      (el) => el.textContent?.trim().slice(0, 5000) || ""
    ).catch(() => "");
    
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
      timeout: options.timeout || 3000,
    }).catch(() => {});
    
    const value = await page.$eval(
      options.selector,
      (el, attr) => el.getAttribute(attr) || "",
      options.attribute
    ).catch(() => "");
    
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
      timeout: options.timeout || 3000,
    }).catch(() => {});
    
    await page.$eval(options.selector, (el) => {
      el.scrollIntoView({ behavior: "auto", block: "center" });
    }).catch(() => {});
    
    await page.waitForTimeout(200);
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