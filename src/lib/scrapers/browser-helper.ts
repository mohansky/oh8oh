import puppeteer from '@cloudflare/puppeteer'

interface BrowserOptions {
  waitForSelector?: string
  timeout?: number
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  skipScroll?: boolean
  waitAfterLoad?: number
  viewport?: { width: number; height: number; isMobile?: boolean; hasTouch?: boolean }
  userAgent?: string
}

/**
 * Fetches a URL and returns the fully rendered HTML after JavaScript execution.
 * Uses @cloudflare/puppeteer with the BROWSER binding.
 *
 * @param browserBinding - Cloudflare BROWSER binding from env
 * @param url - The URL to fetch
 * @param options - Optional configuration
 * @returns The fully rendered HTML content
 */
export async function fetchRenderedHTML(
  browserBinding: unknown,
  url: string,
  options?: BrowserOptions,
): Promise<string> {
  if (!browserBinding) {
    console.warn(`[browser-helper] No BROWSER binding available, skipping: ${url}`)
    return ''
  }

  const timeout = options?.timeout || 30000

  const browser = await puppeteer.launch(browserBinding as any)

  try {
    const page = await browser.newPage()

    await page.setUserAgent(
      options?.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )

    await page.setViewport(
      options?.viewport || {
        width: 1920,
        height: 1080,
      },
    )

    await page.goto(url, {
      waitUntil: options?.waitUntil || 'networkidle0',
      timeout,
    })

    if (options?.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout })
    }

    if (options?.waitAfterLoad) {
      await new Promise((resolve) => setTimeout(resolve, options.waitAfterLoad))
    }

    if (!options?.skipScroll) {
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0
          const distance = 100
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight
            window.scrollBy(0, distance)
            totalHeight += distance
            if (totalHeight >= scrollHeight) {
              clearInterval(timer)
              resolve()
            }
          }, 100)
        })
      })

      // Wait for images to load after scrolling
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return await page.content()
  } finally {
    await browser.close()
  }
}
