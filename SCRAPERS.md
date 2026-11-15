# Scraper Status

Status of every event scraper in [src/lib/scrapers/](src/lib/scrapers/). See
[CLAUDE.md](CLAUDE.md#scraper-pipeline-the-core-data-flow) for how the pipeline
runs (priority ordering, dedup, caching).

**Last updated:** 2026-07-08

## Summary

| Scraper | `id` | Enabled | Priority | Method | Status |
|---|---|:---:|---|---|---|
| Bangalore International Centre | `bic` | ✅ | normal · **fast** | fetch + cheerio | **Working** (verified live) |
| Indian Heritage Academy | `iha` | ✅ | normal · **fast** | fetch + cheerio | **Working** (verified live) |
| Indian Music Experience | `indian-music-experience` | ✅ | normal · **fast** | fetch + cheerio | **Working** (verified live) — now correctly included in fast refresh |
| Urbanaut | `urbanaut` | ✅ | normal | **fetch + cheerio (SSR)** | **Working** — rewritten from Puppeteer to direct fetch; 152 events validated |
| Total Environment | `total-environment` | ✅ | normal | **JSON API** | **Working** — rewritten to the public API; validated. Enabled (was disabled) |
| Sabha | `sabha` | ✅ | low · Puppeteer | Wix, JS-rendered | Likely working — needs live (BROWSER) verification |
| District | `district` | ✅ | low · Puppeteer | JS-rendered | Likely working — needs live verification |
| Skillboxes | `skillboxes` | ✅ | low · Puppeteer | JS-rendered | Likely working — needs live verification |
| MAP (Museum of Art & Photography) | `map` | ✅ | low · Puppeteer | JS-rendered (`/events/`) | ⚠️ **Best-effort / unverified** — see caveat below |
| ~~BookMyShow~~ | — | — | — | — | **Removed** at owner's request (also blocked scraping with HTTP 403) |

**Fast scrapers** (run by the every-30-min background auto-refresh on read):
`FAST_SCRAPER_IDS = ['bic', 'iha', 'indian-music-experience']`. All other enabled
scrapers run only in a **full scrape** (daily cron or an admin's explicit full
refresh).

## Changes in this pass

- **Removed BookMyShow** — deleted the scraper and its registry entry. The site
  actively blocks scraping (HTTP 403) and the owner does not want it scraped.
- **Urbanaut → direct fetch.** Its listing is server-rendered (Angular
  Universal), so Puppeteer was unnecessary. Rewritten to a plain `fetch` +
  cheerio against `https://urbanaut.app/experience-bengaluru/events`. Validated
  against live HTML: **152 events** with title, date, venue, price and link.
  *Limitation:* card images lazy-load client-side (SSR ships a `loading.svg`
  placeholder), so no event image is captured — events are imageless.
- **Total Environment → public API.** It's a client-rendered React app backed by
  `https://api.total-environment.com/api/v1.0/`. Rewritten to: `GET token.json`
  (public JWT, no credentials) → `POST getEvents.json` with `Bearer` token and
  body `{flag:"upcoming"}` → map `result.data.music_events[]`. Validated against
  the live API (title, per-date shows, venue, price, genre, link). **Enabled.**
  *Limitation:* poster filenames have no resolvable public base URL, so events
  are imageless.
- **MAP → Puppeteer on `/events/`** (was a stale direct-fetch of `/whats-on/`,
  which now 301-redirects to `/content-archives/`). See caveat.
- **Fixed the IME fast-refresh bug.** `FAST_SCRAPER_IDS` listed `'ime'` but the
  scraper's id is `'indian-music-experience'`, so IME silently never ran in the
  30-min refresh. Corrected.

## ⚠️ MAP caveat

MAP's `/events/` page ships **empty article shells** and populates the list
client-side via the WordPress Events Manager plugin (admin-ajax), so it needs a
browser to render — hence it's now a low-priority Puppeteer scraper targeting
Events Manager markup (`.em-item`, `.em-event`, …).

**However**, MAP's Events Manager iCal export (`/events/?ical=1`) is currently
**frozen at 2021 events** (newest ≈ Oct 2021). That strongly suggests MAP no
longer publishes upcoming events through this system. If a live run confirms the
rendered page also has no upcoming events, MAP has no usable public source and
should be dropped or pointed at wherever MAP now lists events. **Verify with a
live run before relying on it.**

## Verification method

- **BIC / IHA / IME** — live `curl` + selector-presence checks (server-rendered).
- **Urbanaut / Total Environment** — parser logic validated against **live
  captured data** (SSR HTML / API JSON) using the project's cheerio, confirming
  real events are produced. Final end-to-end still runs through the normal
  pipeline.
- **MAP / Sabha / District / Skillboxes** — Puppeteer/JS-rendered; their content
  needs the Cloudflare `BROWSER` binding and can only be confirmed by a live run:
  `pnpm build && pnpm dev:wrangler`, trigger a full refresh, and check the
  `scraper_runs` table / logs. (The daily cron also exercises them — see
  `[triggers]` in [wrangler.toml](wrangler.toml).)
