# Local Development Guide

## Development Modes

### 1. Regular Development (Recommended for UI work)

```bash
pnpm dev
```

**When to use:**
- Building UI components
- Working on frontend features
- Testing layouts and styles
- Fast hot-reload development

**Limitations:**
- No Cloudflare bindings (DB, R2, BROWSER)
- Database operations will fail
- Scrapers won't work

### 2. Wrangler Development (For testing with bindings)

```bash
# First, build the app
pnpm build

# Then run with wrangler
pnpm dev:wrangler
```

**When to use:**
- Testing database operations
- Testing scrapers with Browser Rendering
- Testing R2 image uploads
- Pre-deployment testing

**Requirements:**
- Must create D1 databases first
- Must enable Browser Rendering in Cloudflare
- Slower than regular dev (no hot reload)

**Note:** This builds the app first, then serves it with Cloudflare Pages dev server.

## Setting Up Cloudflare Bindings for Local Dev

### 1. Create Local D1 Database

```bash
# Create local D1 database for development
wrangler d1 create oh8oh-db-dev --local

# Update wrangler.toml with the database ID
# [[env.dev.d1_databases]]
# database_id = "your-database-id-here"
```

### 2. Run Migrations

```bash
# Generate migration files
pnpm db:generate

# Apply to local dev database
wrangler d1 execute oh8oh-db-dev --local --file=./drizzle/0000_migration.sql
```

### 3. Create Local R2 Bucket

Local R2 buckets are automatically created when you run `wrangler dev`.

### 4. Enable Browser Rendering

Browser Rendering requires a paid Cloudflare account. During development, you can:

**Option A:** Mock the browser binding
**Option B:** Use a fallback to axios for static sites
**Option C:** Enable Browser Rendering in Cloudflare dashboard

## Recommended Workflow

### For Most Development:
```bash
# Use regular dev mode
pnpm dev
```

Work on UI, components, and frontend features. Mock any server-side data as needed.

### Before Committing:
```bash
# Build and test with bindings
pnpm build
pnpm dev:wrangler
```

Test that everything works with actual Cloudflare bindings.

### For Production Testing:
```bash
# Build
pnpm build

# Deploy to preview
pnpm cf:deploy
```

## Mocking Cloudflare Bindings (Advanced)

If you want to develop with mocked bindings in regular dev mode, create a mock file:

```typescript
// src/lib/dev-mocks.ts
export const mockEnv = {
  DB: {
    // Mock D1 database
    prepare: () => ({
      all: async () => ({ results: [] }),
      run: async () => ({ success: true }),
    }),
  },
  R2: {
    // Mock R2 bucket
    put: async () => ({}),
    get: async () => null,
  },
  BROWSER: {
    // Mock browser rendering
    fetch: async () => new Response('mocked html'),
  },
}
```

Then use it in development:
```typescript
const env = process.env.NODE_ENV === 'development' ? mockEnv : realEnv
```

## Environment Variables

Create a `.env.local` file for local development:

```bash
# .env.local
NODE_ENV=development
VITE_API_URL=http://localhost:3000
```

**Note:** Cloudflare bindings are **not** set via environment variables. They're injected by Wrangler at runtime.

## Troubleshooting

### "Database binding not available"
- You're in regular dev mode. Either:
  - Use `pnpm dev:wrangler` instead
  - Or mock the database binding

### "Browser Rendering not enabled"
- Browser Rendering is a paid add-on
- Either enable it in Cloudflare dashboard
- Or mock the browser binding for development

### Hot reload not working with wrangler
- Wrangler dev doesn't support hot reload
- You need to rebuild: `pnpm build && pnpm dev:wrangler`
- For faster iteration, use `pnpm dev` for UI work

### Build is slow
- The first build takes longer
- Subsequent builds are faster with Vite caching
- Consider using `pnpm dev` for most work

## Summary

**Daily Development:**
```bash
pnpm dev  # Fast, hot reload, no bindings
```

**Testing with Bindings:**
```bash
pnpm build && pnpm dev:wrangler  # Slower, has bindings
```

**Deployment:**
```bash
pnpm build && pnpm cf:deploy  # Production deployment
```
