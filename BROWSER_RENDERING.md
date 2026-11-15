# Cloudflare Browser Rendering Migration Guide

This document explains how to use Cloudflare Browser Rendering API instead of Puppeteer for web scraping.

## Why Migrate?

Puppeteer cannot run on Cloudflare Workers because:
- It requires Node.js native modules
- It needs filesystem access
- Workers have no local browser process

Cloudflare Browser Rendering provides a managed browser service that works seamlessly with Workers.

## Setup

### 1. Enable Browser Rendering in Cloudflare

Browser Rendering is a paid add-on for Workers. Enable it:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account
3. Go to **Workers & Pages** → **Browser Rendering**
4. Click **Enable Browser Rendering**
5. Accept pricing ($5/month + usage)

**Pricing:**
- $5/month base fee
- $0.50 per 1000 browser sessions
- Free tier: 1000 sessions/month included

### 2. Configuration

The `wrangler.toml` already includes the browser binding:

```toml
[browser]
binding = "BROWSER"
```

### 3. Update Your Scrapers

#### Old Pattern (Puppeteer):
```typescript
import { fetchRenderedHTML } from './puppeteer-helper'

export const myScraper = {
  scrape: async () => {
    const html = await fetchRenderedHTML(url, options)
    // ... parse HTML
  }
}
```

#### New Pattern (Cloudflare Browser Rendering):
```typescript
import { setBrowserBinding, fetchRenderedHTML } from './puppeteer-helper'

export const myScraper = {
  scrape: async (env: CloudflareEnv) => {
    // Set the browser binding at the start
    setBrowserBinding(env.BROWSER)

    const html = await fetchRenderedHTML(url, options)
    // ... parse HTML
  }
}
```

**OR use the new browser-helper directly:**

```typescript
import { fetchRenderedHTML } from './browser-helper'

export const myScraper = {
  scrape: async (env: CloudflareEnv) => {
    const html = await fetchRenderedHTML(env.BROWSER, url, options)
    // ... parse HTML
  }
}
```

## API Reference

### fetchRenderedHTML(browser, url, options)

Fetches a URL and returns fully rendered HTML after JavaScript execution.

**Parameters:**
- `browser: BrowserBinding` - The BROWSER binding from env
- `url: string` - URL to fetch
- `options?: BrowserOptions` - Optional configuration
  - `waitForSelector?: string` - Wait for specific CSS selector
  - `timeout?: number` - Timeout in milliseconds (default: 30000)
  - `waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'` - Navigation wait condition
  - `skipScroll?: boolean` - Skip auto-scrolling (default: false)
  - `waitAfterLoad?: number` - Extra wait time after load in ms

**Example:**
```typescript
const html = await fetchRenderedHTML(env.BROWSER, 'https://example.com', {
  waitForSelector: '.events-list',
  timeout: 30000,
  waitUntil: 'networkidle0',
  waitAfterLoad: 2000,
})
```

### extractTextContent(browser, url, selector)

Extracts text content from elements matching a CSS selector.

**Parameters:**
- `browser: BrowserBinding` - The BROWSER binding from env
- `url: string` - URL to fetch
- `selector: string` - CSS selector to extract text from

**Returns:** `Promise<string[]>` - Array of text content

**Example:**
```typescript
const texts = await extractTextContent(
  env.BROWSER,
  'https://example.com',
  '.event-title'
)
// ['Event 1', 'Event 2', 'Event 3']
```

### takeScreenshot(browser, r2, url, filename)

Takes a screenshot and stores it in R2.

**Parameters:**
- `browser: BrowserBinding` - The BROWSER binding from env
- `r2: R2Bucket` - The R2 binding from env
- `url: string` - URL to screenshot
- `filename: string` - Filename with extension (.png, .jpeg, .webp)

**Returns:** `Promise<string>` - URL to screenshot in R2

**Example:**
```typescript
const screenshotUrl = await takeScreenshot(
  env.BROWSER,
  env.R2,
  'https://example.com',
  'debug-screenshot.png'
)
```

## Migration Checklist

- [ ] Enable Browser Rendering in Cloudflare dashboard
- [ ] Update scrapers to accept `env` parameter
- [ ] Call `setBrowserBinding(env.BROWSER)` at start of each scraper
- [ ] Test scrapers locally with `wrangler dev`
- [ ] Test scrapers in production
- [ ] Remove Puppeteer dependency: `pnpm remove puppeteer`

## Cost Optimization

Browser sessions can be expensive. Optimize costs by:

1. **Cache aggressively**: Cache scraped results in D1/KV
2. **Rate limit**: Don't scrape same site too frequently
3. **Use static scrapers**: For sites without JavaScript, use `axios` + `cheerio`
4. **Batch requests**: Scrape multiple pages in one session
5. **Monitor usage**: Check dashboard for session counts

## Limitations

### Browser Rendering Limitations:
- 30-second max session duration
- No browser extensions
- No custom fonts
- No audio/video playback
- Limited to Chromium browser

### Vs Puppeteer:
- ✅ Runs on Cloudflare Workers
- ✅ No cold starts (always warm)
- ✅ Managed infrastructure
- ❌ Costs money ($5/mo + usage)
- ❌ Can't customize Chrome flags as much
- ❌ No local debugging (must use wrangler dev)

## Debugging

### Test Browser Rendering Locally:

```bash
# Use wrangler dev to test with Browser Rendering
pnpm dev:wrangler
```

### View Browser Rendering Logs:

```bash
wrangler pages deployment tail --environment production
```

### Check Session Usage:

1. Go to Cloudflare Dashboard
2. Workers & Pages → Browser Rendering
3. View usage statistics

## Troubleshooting

### "Browser binding not set"
- Make sure you called `setBrowserBinding(env.BROWSER)` at the start
- Check that `env.BROWSER` is available (run with wrangler)

### "Browser Rendering API error: 401"
- Check that Browser Rendering is enabled in dashboard
- Verify your account has payment method on file

### "Script timeout"
- Reduce `timeout` option
- Optimize selectors (use specific, fast selectors)
- Skip scroll if not needed: `skipScroll: true`

### "Too many sessions"
- Check if scrapers are running too frequently
- Implement caching to reduce sessions
- Review scraper code for infinite loops

## Resources

- [Cloudflare Browser Rendering Docs](https://developers.cloudflare.com/browser-rendering/)
- [Browser Rendering API Reference](https://developers.cloudflare.com/browser-rendering/api/)
- [Puppeteer Documentation](https://pptr.dev/) (for script syntax)
- [Pricing Calculator](https://developers.cloudflare.com/browser-rendering/pricing/)
