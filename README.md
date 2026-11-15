# oh8oh — Bangalore events aggregator

A Progressive Web App that collects upcoming events in Bangalore from venue and
ticketing sites into one list. Built with TanStack Start and deployed on
Cloudflare Workers.

Live: https://oh8oh.mohansky.workers.dev

## Features

- One list of upcoming events, scraped daily from nine sources and de-duplicated
- Search, and filters for today / tomorrow / this weekend and category
- Calendar view, featured events, shareable event pages, add-to-calendar (.ics)
- Accounts with email verification; bookmarks
- Hosts can submit events, which admins review before they are listed
- Installable PWA with dark mode

## Tech stack

| | |
| --- | --- |
| Framework | TanStack Start (React 19 SSR) and TanStack Router |
| Runtime | Cloudflare Workers via Nitro (`cloudflare-module` preset) |
| Database | Turso (libSQL) with Drizzle ORM |
| Auth | Better Auth (email + password, verification emails via Resend) |
| Storage | Cloudflare R2 for uploaded event images |
| Scraping | cheerio for static pages, Cloudflare Browser Rendering for JS-rendered ones |
| UI | Tailwind CSS 4, shadcn/ui (Radix), vite-plugin-pwa |

## Getting started

Requires Node.js 20+ and pnpm.

```bash
git clone https://github.com/mohansky/oh8oh.git
cd oh8oh
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev                     # http://localhost:3000
```

You need a [Turso](https://turso.tech) database and a
[Resend](https://resend.com) API key at minimum; `.env.example` lists every
variable.

### Database

The schema lives in `src/db/schema.ts` and migrations in `drizzle/`.

```bash
pnpm db:generate   # create a migration after changing the schema
pnpm db:migrate    # apply migrations to the Turso database
pnpm db:studio     # browse the data
```

drizzle-kit reads `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from the shell
environment, so export them before running these.

### Two ways to run locally

- `pnpm dev` — Vite dev server with hot reload. No Cloudflare bindings, so
  image uploads (R2) and the browser-based scrapers are unavailable.
- `pnpm build && pnpm dev:wrangler` — runs the production build in Wrangler
  with real bindings.

## Scripts

```bash
pnpm dev            # dev server
pnpm build          # production build to .output/
pnpm dev:wrangler   # run the build in Wrangler
pnpm test           # unit tests (Vitest)
pnpm lint           # ESLint
pnpm check          # Prettier + ESLint --fix
pnpm cf:deploy      # build and deploy to Cloudflare
```

## Deployment

1. `pnpm cf:login`
2. Create the R2 bucket named in `wrangler.toml` and enable Browser Rendering.
3. Set the secrets:

   ```bash
   wrangler secret put BETTER_AUTH_SECRET
   wrangler secret put BETTER_AUTH_URL      # the production URL
   wrangler secret put TURSO_DATABASE_URL
   wrangler secret put TURSO_AUTH_TOKEN
   wrangler secret put RESEND_API_KEY
   wrangler secret put RESEND_FROM_EMAIL
   ```

4. `pnpm cf:deploy`

A Cron Trigger (see `wrangler.toml`) runs the full scrape daily at 03:00 IST.
Between those runs, page loads trigger a lighter refresh of the fast sources at
most every 30 minutes.

## How it works

Each source has a scraper in `src/lib/scrapers/`. Results are de-duplicated
across sources and stored in the `events` table; pages always read from the
database, never from the source sites directly. Events that have ended are
filtered out and later pruned.

- [SCRAPERS.md](./SCRAPERS.md) — the sources and how each is scraped
- [src/lib/scrapers/README.md](./src/lib/scrapers/README.md) — adding a scraper
- [CLAUDE.md](./CLAUDE.md) — architecture notes and gotchas

## License

MIT
