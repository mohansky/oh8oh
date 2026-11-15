# oh8oh - Bangalore Events Aggregator

A Progressive Web App for discovering and exploring upcoming events in Bangalore. Built with TanStack Start and deployed on Cloudflare Workers.

## Features

- Browse upcoming events in Bangalore
- Filter events by date, category, and source
- Save events to bookmarks
- Add custom events
- Calendar view
- Featured events section
- PWA support with offline functionality
- Dark mode support
- Admin dashboard for event management

## Tech Stack

### Frontend
- **Framework**: TanStack Start (React SSR)
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Radix UI, Lucide Icons
- **Forms**: TanStack Form
- **Routing**: TanStack Router
- **State Management**: React Hooks
- **PWA**: vite-plugin-pwa with Workbox

### Backend
- **Runtime**: Cloudflare Workers
- **Server**: Nitro (cloudflare-module preset)
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Storage**: Cloudflare R2
- **Authentication**: Better Auth with Passkey support
- **Web Scraping**: Cloudflare Browser Rendering API

### Development
- **Build Tool**: Vite 7
- **Package Manager**: pnpm
- **Testing**: Vitest
- **Linting**: ESLint
- **Formatting**: Prettier

## Prerequisites

- Node.js 18+ and pnpm
- Cloudflare account (free tier works for development)
- Wrangler CLI (installed via dev dependencies)

## Setup

### 1. Clone and Install

\`\`\`bash
git clone <repository-url>
cd oh8oh
pnpm install
\`\`\`

### 2. Environment Configuration

Copy the example environment file:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Update \`.env.local\` with your configuration:

\`\`\`env
NODE_ENV=development
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:3000
\`\`\`

### 3. Database Setup

Create and migrate the database:

\`\`\`bash
# Generate migration files
pnpm db:generate

# Create D1 database in Cloudflare (if not exists)
wrangler d1 create oh8oh-db-dev

# Run migrations locally
wrangler d1 execute oh8oh-db-dev --local --file=./drizzle/0000_migration.sql

# For production
pnpm db:migrate:prod
\`\`\`

### 4. Cloudflare Bindings

Update \`wrangler.toml\` with your Cloudflare IDs:

- \`account_id\`: Your Cloudflare account ID
- \`database_id\`: Your D1 database ID (from step 3)
- Create R2 bucket: \`wrangler r2 bucket create event-app\`
- Enable Browser Rendering in Cloudflare dashboard

## Development

### Regular Development (Fast, no bindings)

Best for UI work and frontend features:

\`\`\`bash
pnpm dev
\`\`\`

Runs on http://localhost:3000 with hot reload.

**Note**: Database, R2, and Browser Rendering won't work in this mode.

### Wrangler Development (With Cloudflare bindings)

For testing with full Cloudflare features:

\`\`\`bash
pnpm build
pnpm dev:wrangler
\`\`\`

This mode includes D1, R2, and Browser Rendering bindings.

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for detailed development workflows.

## Available Scripts

\`\`\`bash
pnpm dev              # Start dev server
pnpm dev:wrangler     # Start with Cloudflare bindings
pnpm build            # Build for production
pnpm preview          # Preview production build
pnpm test             # Run tests
pnpm lint             # Lint code
pnpm format           # Format code
pnpm check            # Format and lint

# Database
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations (dev)
pnpm db:migrate:prod  # Run migrations (production)
pnpm db:studio        # Open Drizzle Studio

# Cloudflare
pnpm cf:deploy        # Deploy to Cloudflare
pnpm cf:deploy:prod   # Deploy to production
pnpm cf:login         # Login to Cloudflare
pnpm cf:whoami        # Check Cloudflare account
\`\`\`

## Deployment

### First Time Setup

1. Login to Cloudflare:

\`\`\`bash
pnpm cf:login
\`\`\`

2. Set production secrets:

\`\`\`bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put SESSION_SECRET
wrangler secret put BETTER_AUTH_URL  # Your production URL
\`\`\`

3. Create production database:

\`\`\`bash
wrangler d1 create oh8oh-db-prod
\`\`\`

Update \`wrangler.toml\` with the production database ID.

### Deploy

\`\`\`bash
# Deploy to preview
pnpm cf:deploy

# Deploy to production
pnpm cf:deploy:prod
\`\`\`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Project Structure

\`\`\`
oh8oh/
├── src/
│   ├── components/       # React components
│   ├── routes/          # TanStack Router routes
│   ├── db/              # Database schema and client
│   ├── lib/             # Utilities and helpers
│   │   └── scrapers/    # Event scrapers
│   ├── hooks/           # Custom React hooks
│   ├── providers/       # React context providers
│   ├── types/           # TypeScript types
│   └── styles.css       # Global styles
├── public/              # Static assets
├── drizzle/            # Database migrations
├── scripts/            # Build and deployment scripts
├── .env.example        # Environment template
├── wrangler.toml       # Cloudflare configuration
├── nitro.config.ts     # Nitro server config
├── vite.config.ts      # Vite build config
└── drizzle.config.ts   # Drizzle ORM config
\`\`\`

## Documentation

- [Local Development Guide](./LOCAL_DEVELOPMENT.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Browser Rendering API](./BROWSER_RENDERING.md)
- [Migration Checklist](./MIGRATION_CHECKLIST.md)

## Features in Development

- Email notifications for event updates
- User event submissions
- Event recommendations
- Social sharing
- Multiple city support

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
