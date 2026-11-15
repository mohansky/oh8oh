/**
 * DEPRECATED: This file is maintained for backward compatibility
 * New code should use browser-helper.ts with Cloudflare Browser Rendering API
 *
 * This wrapper allows existing scrapers to work without immediate migration
 * by using the BROWSER binding from Cloudflare environment
 */

import type { BrowserBinding } from '../../types/cloudflare'
import * as browserHelper from './browser-helper'

// Global browser binding - will be set by scrapers that need it
let globalBrowser: BrowserBinding | null = null

/**
 * Set the browser binding for use by helper functions
 * Call this at the start of your scraper with env.BROWSER
 */
export function setBrowserBinding(browser: BrowserBinding) {
  globalBrowser = browser
}

/**
 * Fetches a URL and returns the fully rendered HTML after JavaScript execution
 * Uses Cloudflare Browser Rendering API
 *
 * @param url - The URL to fetch
 * @param options - Optional configuration
 * @returns The fully rendered HTML content
 */
export async function fetchRenderedHTML(
  url: string,
  options?: {
    waitForSelector?: string
    timeout?: number
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
    skipScroll?: boolean
    waitAfterLoad?: number
  },
): Promise<string> {
  if (!globalBrowser) {
    throw new Error(
      'Browser binding not set. Call setBrowserBinding(env.BROWSER) before using this function.'
    )
  }

  return browserHelper.fetchRenderedHTML(globalBrowser, url, options)
}

/**
 * Fetches a URL and extracts text content from a specific selector
 *
 * @param url - The URL to fetch
 * @param selector - CSS selector to extract content from
 * @returns Array of text content from matching elements
 */
export async function extractTextContent(
  url: string,
  selector: string,
): Promise<string[]> {
  if (!globalBrowser) {
    throw new Error(
      'Browser binding not set. Call setBrowserBinding(env.BROWSER) before using this function.'
    )
  }

  return browserHelper.extractTextContent(globalBrowser, url, selector)
}

/**
 * Takes a screenshot of a page (useful for debugging)
 * Note: Requires R2 binding to be passed
 *
 * @param url - The URL to screenshot
 * @param outputPath - Path to save the screenshot (must end with .png, .jpeg, or .webp)
 * @param r2 - R2 bucket binding for storage
 */
export async function takeScreenshot(
  url: string,
  outputPath: `${string}.png` | `${string}.jpeg` | `${string}.webp`,
  r2?: any,
): Promise<void> {
  if (!globalBrowser) {
    throw new Error(
      'Browser binding not set. Call setBrowserBinding(env.BROWSER) before using this function.'
    )
  }

  if (!r2) {
    throw new Error('R2 binding required for takeScreenshot')
  }

  await browserHelper.takeScreenshot(globalBrowser, r2, url, outputPath)
}
