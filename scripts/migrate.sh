#!/bin/bash

# Cloudflare D1 Migration Script
# This script helps you manage D1 database migrations

set -e

ENVIRONMENT=${1:-dev}

echo "🔄 Running migrations for environment: $ENVIRONMENT"

# Generate migrations
echo "📝 Generating migration files..."
pnpm drizzle-kit generate

# Get the latest migration file
MIGRATION_FILE=$(ls -t drizzle/*.sql | head -1)

if [ -z "$MIGRATION_FILE" ]; then
    echo "❌ No migration files found"
    exit 1
fi

echo "📄 Found migration: $MIGRATION_FILE"

# Apply migration based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    echo "⚠️  WARNING: You are about to migrate the PRODUCTION database!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Migration cancelled"
        exit 0
    fi

    echo "🚀 Applying migration to production D1..."
    wrangler d1 execute oh8oh-db --file="$MIGRATION_FILE"
else
    echo "🔧 Applying migration to development D1..."
    wrangler d1 execute oh8oh-db-dev --local --file="$MIGRATION_FILE"
fi

echo "✅ Migration completed successfully!"
