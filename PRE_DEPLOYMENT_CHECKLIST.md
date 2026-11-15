# Pre-Deployment Checklist

Complete this checklist before deploying to Cloudflare Workers.

## 1. Code Cleanup

- [x] Updated .gitignore to exclude build artifacts and sensitive files
- [x] Created comprehensive README.md
- [x] Updated compatibility_date to 2024-12-01
- [x] Verified no secrets in wrangler.toml (only comments)
- [ ] Run linter: `pnpm lint`
- [ ] Run formatter: `pnpm format`
- [ ] Build successfully: `pnpm build`

## 2. Git Repository

- [ ] Add all files: `git add .`
- [ ] Review staged changes: `git status`
- [ ] Commit changes: `git commit -m "feat: Initial oh8oh PWA with Cloudflare Workers"`
- [ ] Create GitHub repository
- [ ] Push to GitHub: `git remote add origin <url> && git push -u origin master`

## 3. Cloudflare Setup

### Account & Authentication
- [ ] Login to Cloudflare: `pnpm cf:login`
- [ ] Verify account: `pnpm cf:whoami`

### D1 Database
- [ ] Database already created: `oh8oh-db-dev` (ID: 761f1c80-e3f1-4ef7-aaa3-b362b0aa4871)
- [ ] Run migrations: `pnpm db:migrate:prod`
- [ ] Verify migration success

### R2 Bucket
- [ ] Create R2 bucket: `wrangler r2 bucket create event-app`
- [ ] Verify bucket created: `wrangler r2 bucket list`

### Browser Rendering
- [ ] Enable Browser Rendering in Cloudflare dashboard
- [ ] Go to Workers & Pages > Browser Rendering
- [ ] Enable the feature (10 hours free per month)

### Secrets
Set these secrets before deployment:

```bash
wrangler secret put BETTER_AUTH_SECRET
# Enter a random 32+ character string

wrangler secret put SESSION_SECRET
# Enter a different random 32+ character string

wrangler secret put BETTER_AUTH_URL
# Enter your production URL (e.g., https://oh8oh.yourdomain.com)
```

Generate secrets:
```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## 4. Environment Variables

Verify [vars] section in wrangler.toml:
- [x] ENVIRONMENT = "production"

## 5. Assets Configuration

- [x] Assets bucket configured in wrangler.toml
- [ ] Verify PWA icons exist in public/:
  - [x] favicon.ico
  - [x] favicon.png
  - [x] o8o.png
  - [x] o8o-maskable.png (needs to be created)

## 6. Build & Test Locally

```bash
# Build the app
pnpm build

# Test with wrangler locally
pnpm dev:wrangler
```

Verify:
- [ ] App loads successfully
- [ ] Database queries work
- [ ] Authentication works
- [ ] PWA manifest loads
- [ ] Service worker registers

## 7. Deploy

### First Deployment

```bash
pnpm cf:deploy
```

This will:
1. Build the application
2. Upload to Cloudflare Workers
3. Deploy the worker
4. Provide a deployment URL

### Verify Deployment

After deployment, test:
- [ ] Visit the deployed URL
- [ ] Check homepage loads
- [ ] Test authentication (sign up/login)
- [ ] Test database (view events)
- [ ] Test PWA install prompt
- [ ] Test offline functionality
- [ ] Check browser console for errors

## 8. Custom Domain (Optional)

If you want to use a custom domain:

1. Add domain in Cloudflare dashboard:
   - Workers & Pages > oh8oh > Settings > Domains & Routes
   - Click "Add" and enter your domain
   - Follow DNS setup instructions

2. Update BETTER_AUTH_URL secret:
```bash
wrangler secret put BETTER_AUTH_URL
# Enter: https://yourdomain.com
```

## 9. Post-Deployment

- [ ] Set up monitoring in Cloudflare dashboard
- [ ] Enable error tracking
- [ ] Set up usage alerts
- [ ] Test event scrapers work with Browser Rendering
- [ ] Monitor initial usage and costs

## 10. Production Environment

Create a production environment in wrangler.toml:

```toml
[env.production]
name = "oh8oh-prod"

[[env.production.d1_databases]]
binding = "DB"
database_name = "oh8oh-db-prod"
database_id = "your-prod-database-id-here"
```

Then deploy to production:
```bash
pnpm cf:deploy:prod
```

## Troubleshooting

### Build Fails
- Check Node.js version (18+)
- Clear .output and node_modules: `rm -rf .output node_modules && pnpm install`
- Check for TypeScript errors: `pnpm build`

### Database Not Found
- Verify database ID in wrangler.toml
- Run migrations: `pnpm db:migrate:prod`
- Check D1 dashboard: https://dash.cloudflare.com/

### Browser Rendering Not Working
- Verify it's enabled in dashboard
- Check you have available hours in quota
- Test with a simple scraper first

### Secrets Not Working
- Verify secrets are set: `wrangler secret list`
- Re-set secrets if needed
- Check secret names match code

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Browser Rendering Docs](https://developers.cloudflare.com/browser-rendering/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

## Ready to Deploy?

Once all items are checked, you're ready to deploy!

```bash
pnpm cf:deploy
```

Good luck!
