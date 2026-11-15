# Cloudflare Deployment Guide

This guide walks you through deploying your oh8oh app to Cloudflare Pages with Workers and D1 database.

## Prerequisites

1. **Cloudflare Account**: Sign up at [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. **Wrangler CLI**: Already installed via `pnpm install`
3. **Node.js**: Version 18 or higher

## Step 1: Login to Cloudflare

```bash
pnpm cf:login
```

This will open your browser to authenticate with Cloudflare.

Verify you're logged in:
```bash
pnpm cf:whoami
```

## Step 2: Get Your Account ID

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Select your account
3. Copy your Account ID from the right sidebar
4. Update `wrangler.toml`:
   ```toml
   account_id = "your_account_id_here"
   ```

## Step 3: Create D1 Databases

Create production database:
```bash
wrangler d1 create oh8oh-db
```

Create development database:
```bash
wrangler d1 create oh8oh-db-dev
```

Copy the `database_id` values from the output and update them in `wrangler.toml`: 
```toml
[[d1_databases]]
binding = "DB"
database_name = "oh8oh-db"
database_id = "your_prod_database_id_here"

[[env.dev.d1_databases]]
binding = "DB"
database_name = "oh8oh-db-dev"
database_id = "your_dev_database_id_here"
```



## Step 4: Create R2 Bucket (for images)

Create production bucket:
```bash
wrangler r2 bucket create oh8oh-images
```

Create development bucket:
```bash
wrangler r2 bucket create oh8oh-images-dev
```

## Step 5: Run Database Migrations

Generate migration files:
```bash
pnpm db:generate
```

Apply to development database:
```bash
pnpm db:migrate
```

Apply to production database (when ready):
```bash
pnpm db:migrate:prod
```

## Step 6: Set Environment Secrets

Set production secrets (these are encrypted and not in wrangler.toml):

```bash
# Auth secret
wrangler secret put BETTER_AUTH_SECRET
# Paste a long random string

# Production URL (after deploying)
wrangler secret put BETTER_AUTH_URL
# Paste: https://your-app.pages.dev

# Session secret
wrangler secret put SESSION_SECRET
# Paste a long random string
```

## Step 7: Build for Production

```bash
pnpm build
```

This creates an optimized build in `.output/`

## Step 8: Deploy to Cloudflare Pages

First deployment:
```bash
pnpm cf:deploy
```

For production deployments (main branch):
```bash
pnpm cf:deploy:prod
```

## Step 9: Configure Custom Domain (Optional)

1. Go to Cloudflare Pages dashboard
2. Select your project
3. Go to "Custom domains"
4. Add your domain and follow DNS instructions
5. Update BETTER_AUTH_URL secret with your custom domain

## Local Development with Wrangler

To develop locally with D1 bindings:

```bash
pnpm dev:wrangler
```

This runs your app with Cloudflare Workers runtime locally, giving you access to D1, R2, and other bindings.

## Important Notes

### Puppeteer Compatibility

⚠️ **Puppeteer does not work on Cloudflare Workers**. If you're using Puppeteer for web scraping, you have these options:

1. **Use Cloudflare Browser Rendering API** (recommended)
   - Cloudflare provides a managed browser service
   - See: https://developers.cloudflare.com/browser-rendering/

2. **Run scrapers separately**
   - Deploy scrapers to a traditional server (AWS Lambda, etc.)
   - Use Cloudflare Workers for the web app only
   - Scrapers can write directly to D1 via API

3. **Use a third-party scraping service**
   - Services like ScrapingBee, Bright Data, etc.

### Database Migrations

- **Development**: Migrations run against local D1 database
- **Production**: Always review migrations before applying to prod
- **Backup**: D1 doesn't have built-in backups yet, export data regularly

### R2 vs S3

- Replace AWS S3 SDK calls with R2 SDK
- R2 is S3-compatible but uses different authentication
- Update image upload code to use the R2 binding

## Monitoring and Logs

View logs:
```bash
wrangler pages deployment tail
```

View analytics:
- Go to Cloudflare Pages dashboard
- Select your project
- View "Analytics" and "Web Analytics"

## Rollback

To rollback to a previous deployment:
1. Go to Cloudflare Pages dashboard
2. Select "Deployments"
3. Find the previous working deployment
4. Click "..." → "Rollback to this deployment"

## Cost Estimate

Cloudflare's Free Tier includes:
- 100,000 requests/day on Pages
- 5 million D1 reads/month
- 100,000 D1 writes/month
- 10 GB R2 storage
- 10 million R2 requests/month

For most small-to-medium apps, this is sufficient. Paid plans scale from there.

## Troubleshooting

### Error: "Database binding not available"
- Make sure you're running with `wrangler dev` or deployed to Cloudflare
- Check `wrangler.toml` has correct database bindings

### Error: "R2 binding not found"
- Verify R2 bucket exists: `wrangler r2 bucket list`
- Check `wrangler.toml` R2 binding configuration

### Deployment fails
- Run `pnpm build` locally first to catch build errors
- Check `wrangler.toml` for syntax errors
- Verify account_id is correct

## Next Steps

After deployment:
1. Set up custom domain
2. Configure WAF rules for security
3. Enable Web Analytics
4. Set up deployment pipeline (GitHub Actions)
5. Monitor D1 usage in Cloudflare dashboard

## Support

- Cloudflare Docs: https://developers.cloudflare.com
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler
- D1 Docs: https://developers.cloudflare.com/d1
