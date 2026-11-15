# Migration Checklist: Cloudflare Deployment

This checklist helps you migrate your existing code to work with Cloudflare D1 and Workers.

## ✅ Completed Setup

- [x] Installed Cloudflare dependencies
- [x] Created wrangler.toml configuration
- [x] Updated database client for D1
- [x] Created migration scripts
- [x] Added TypeScript types for Cloudflare
- [x] Updated package.json with deployment commands
- [x] Created nitro.config.ts for Cloudflare Pages

## 🔧 Code Changes Required

### 1. Update Database Imports

**OLD Pattern** (won't work anymore):
```typescript
import { db } from '../db'

// Direct usage
const users = await db.select().from(userTable)
```

**NEW Pattern** (required for Cloudflare):
```typescript
import { getDB } from '../db'

// In server functions, get env from context
const db = getDB(ctx.cloudflare.env)
const users = await db.select().from(userTable)
```

### 2. Update All Server Functions

You need to update every `createServerFn` to access the database properly.

**Example - Before**:
```typescript
const myServerFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { db } = await import('../db')
    const data = await db.select().from(table)
    return data
  })
```

**Example - After**:
```typescript
const myServerFn = createServerFn({ method: 'GET' })
  .handler(async (ctx: any) => {
    const { getDB } = await import('../db')
    const db = getDB(ctx.cloudflare?.env)
    const data = await db.select().from(table)
    return data
  })
```

### 3. Files That Need Updates

Search your codebase for these patterns and update them:

```bash
# Find all database imports
grep -r "import.*from.*'../db'" src/

# Find all server functions
grep -r "createServerFn" src/
```

**Files likely needing updates**:
- [ ] `src/routes/index.tsx` - `scrapeEvents` function
- [ ] `src/routes/my-events.tsx` - `checkUserRole` function
- [ ] `src/routes/add-event.tsx` - `checkUserRole` function
- [ ] `src/lib/server/user-events.ts` - All server functions
- [ ] `src/lib/server/events-refresh.ts` - Refresh function
- [ ] Any other files with `createServerFn`

### 4. Update S3 to R2

**OLD - AWS S3**:
```typescript
import { S3Client } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  }
})
```

**NEW - Cloudflare R2**:
```typescript
// In server function
const r2 = ctx.cloudflare.env.R2

// Upload file
await r2.put('filename.jpg', fileData, {
  httpMetadata: {
    contentType: 'image/jpeg',
  }
})

// Get file URL
const url = `https://your-r2-domain.com/filename.jpg`
```

### 5. Handle Puppeteer

⚠️ **Puppeteer doesn't work on Cloudflare Workers**

Options:
1. **Use Cloudflare Browser Rendering API** (recommended)
2. **Run scrapers separately** on a traditional server
3. **Use a scraping service** (ScrapingBee, Bright Data, etc.)

If you have scraping code, you'll need to refactor it.

## 📝 Configuration Steps

### 1. Environment Setup

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your Cloudflare credentials
```

### 2. Cloudflare Account Setup

```bash
# Login to Cloudflare
pnpm cf:login

# Verify login
pnpm cf:whoami
```

### 3. Create D1 Databases

```bash
# Production
wrangler d1 create oh8oh-db

# Development
wrangler d1 create oh8oh-db-dev
```

**Copy the database IDs** to `wrangler.toml`:
```toml
[[d1_databases]]
database_id = "paste-production-id-here"

[[env.dev.d1_databases]]
database_id = "paste-dev-id-here"
```

### 4. Create R2 Buckets

```bash
# Production
wrangler r2 bucket create oh8oh-images

# Development
wrangler r2 bucket create oh8oh-images-dev
```

### 5. Run Migrations

```bash
# Generate migration files
pnpm db:generate

# Apply to dev database
pnpm db:migrate

# Later, apply to production
pnpm db:migrate:prod
```

### 6. Set Secrets

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put SESSION_SECRET
```

## 🧪 Testing

### Local Development

```bash
# Option 1: Regular Vite dev (no D1 binding)
pnpm dev

# Option 2: Wrangler dev (with D1 binding)
pnpm dev:wrangler
```

### Build Test

```bash
pnpm build
```

Check for errors related to:
- Database imports
- Missing environment bindings
- Puppeteer usage

## 🚀 Deployment

```bash
# Build
pnpm build

# Deploy to Cloudflare Pages
pnpm cf:deploy

# For production
pnpm cf:deploy:prod
```

## ⚠️ Common Issues

### "Database binding not available"
- Make sure you're using `getDB(env)` pattern
- Check `wrangler.toml` has correct bindings
- Run with `pnpm dev:wrangler` for local testing

### Build fails with Puppeteer errors
- Puppeteer won't work on Workers
- Remove or externalize Puppeteer code
- Consider Cloudflare Browser Rendering API

### R2 images not loading
- Check CORS settings on R2 bucket
- Verify public access settings
- Use correct R2 custom domain

## 📚 Resources

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages)
- [Nitro Cloudflare Preset](https://nitro.unjs.io/deploy/providers/cloudflare)
