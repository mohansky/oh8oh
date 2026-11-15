import type { BrowserBinding } from '../../types/cloudflare'

/**
 * Cloudflare Browser Rendering Helper
 * Replaces Puppeteer with Cloudflare's Browser Rendering API
 *
 * Documentation: https://developers.cloudflare.com/browser-rendering/
 */

interface BrowserOptions {
  waitForSelector?: string
  timeout?: number
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  skipScroll?: boolean
  waitAfterLoad?: number
}

/**
 * Fetches a URL and returns the fully rendered HTML after JavaScript execution
 * Uses Cloudflare Browser Rendering API instead of Puppeteer
 *
 * @param browser - Cloudflare BROWSER binding from env
 * @param url - The URL to fetch
 * @param options - Optional configuration
 * @returns The fully rendered HTML content
 */
export async function fetchRenderedHTML(
  browser: BrowserBinding,
  url: string,
  options?: BrowserOptions,
): Promise<string> {
  const timeout = options?.timeout || 30000

  // Build the Puppeteer script to run in Cloudflare's browser
  const script = `
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();

      // Set a realistic user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set viewport
      await page.setViewport({
        width: 1920,
        height: 1080,
      });

      // Navigate to the page
      await page.goto('${url.replace(/'/g, "\\'")}', {
        waitUntil: '${options?.waitUntil || 'networkidle0'}',
        timeout: ${timeout},
      });

      ${options?.waitForSelector ? `
      // Wait for specific selector
      await page.waitForSelector('${options.waitForSelector.replace(/'/g, "\\'")}', {
        timeout: ${timeout},
      });
      ` : ''}

      ${options?.waitAfterLoad ? `
      // Extra wait for JavaScript rendering
      await new Promise(resolve => setTimeout(resolve, ${options.waitAfterLoad}));
      ` : ''}

      ${!options?.skipScroll ? `
      // Scroll down the page to trigger lazy-loading
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      // Wait for images to load after scrolling
      await new Promise(resolve => setTimeout(resolve, 1000));
      ` : ''}

      // Get the rendered HTML
      const html = await page.content();

      return html;
    } finally {
      await browser.close();
    }
  `

  try {
    // Send request to Cloudflare Browser Rendering API
    const response = await browser.fetch('https://browser-rendering-api.pages.dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script,
        timeout,
      }),
    })

    if (!response.ok) {
      throw new Error(`Browser Rendering API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json() as { result: string; error?: string }

    if (result.error) {
      throw new Error(`Browser script error: ${result.error}`)
    }

    return result.result
  } catch (error) {
    console.error('Error in fetchRenderedHTML:', error)
    throw error
  }
}

/**
 * Fetches a URL and extracts text content from a specific selector
 *
 * @param browser - Cloudflare BROWSER binding from env
 * @param url - The URL to fetch
 * @param selector - CSS selector to extract content from
 * @returns Array of text content from matching elements
 */
export async function extractTextContent(
  browser: BrowserBinding,
  url: string,
  selector: string,
): Promise<string[]> {
  const script = `
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );

      await page.goto('${url.replace(/'/g, "\\'")}', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Extract text from all matching elements
      const texts = await page.$$eval('${selector.replace(/'/g, "\\'")}', (elements) =>
        elements.map((el) => el.textContent?.trim() || '')
      );

      return texts.filter((text) => text.length > 0);
    } finally {
      await browser.close();
    }
  `

  try {
    const response = await browser.fetch('https://browser-rendering-api.pages.dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script,
        timeout: 30000,
      }),
    })

    if (!response.ok) {
      throw new Error(`Browser Rendering API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json() as { result: string[]; error?: string }

    if (result.error) {
      throw new Error(`Browser script error: ${result.error}`)
    }

    return result.result
  } catch (error) {
    console.error('Error in extractTextContent:', error)
    throw error
  }
}

/**
 * Takes a screenshot of a page (useful for debugging)
 * Stores screenshot in R2 bucket
 *
 * @param browser - Cloudflare BROWSER binding from env
 * @param r2 - Cloudflare R2 binding from env
 * @param url - The URL to screenshot
 * @param filename - Filename to save in R2 (must end with .png, .jpeg, or .webp)
 * @returns URL to the screenshot in R2
 */
export async function takeScreenshot(
  browser: BrowserBinding,
  r2: R2Bucket,
  url: string,
  filename: `${string}.png` | `${string}.jpeg` | `${string}.webp`,
): Promise<string> {
  const script = `
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();

      await page.setViewport({
        width: 1920,
        height: 1080,
      });

      await page.goto('${url.replace(/'/g, "\\'")}', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Take screenshot and return as base64
      const screenshot = await page.screenshot({
        fullPage: true,
        encoding: 'base64',
      });

      return screenshot;
    } finally {
      await browser.close();
    }
  `

  try {
    const response = await browser.fetch('https://browser-rendering-api.pages.dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script,
        timeout: 30000,
      }),
    })

    if (!response.ok) {
      throw new Error(`Browser Rendering API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json() as { result: string; error?: string }

    if (result.error) {
      throw new Error(`Browser script error: ${result.error}`)
    }

    // Convert base64 to buffer and upload to R2
    const buffer = Buffer.from(result.result, 'base64')

    const contentType = filename.endsWith('.png') ? 'image/png' :
                       filename.endsWith('.jpeg') ? 'image/jpeg' :
                       'image/webp'

    await r2.put(filename, buffer, {
      httpMetadata: {
        contentType,
      },
    })

    // Return R2 URL (you'll need to configure your R2 custom domain)
    return `https://your-r2-domain.com/${filename}`
  } catch (error) {
    console.error('Error in takeScreenshot:', error)
    throw error
  }
}

// Import R2Bucket type
import type { R2Bucket } from '@cloudflare/workers-types'
