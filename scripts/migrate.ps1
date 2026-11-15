# Cloudflare D1 Migration Script (PowerShell)
# This script helps you manage D1 database migrations

param(
    [string]$Environment = "dev"
)

Write-Host "🔄 Running migrations for environment: $Environment" -ForegroundColor Cyan

# Generate migrations
Write-Host "📝 Generating migration files..." -ForegroundColor Yellow
pnpm drizzle-kit generate

# Get the latest migration file
$MigrationFile = Get-ChildItem -Path "drizzle\*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $MigrationFile) {
    Write-Host "❌ No migration files found" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Found migration: $($MigrationFile.Name)" -ForegroundColor Green

# Apply migration based on environment
if ($Environment -eq "production") {
    Write-Host "⚠️  WARNING: You are about to migrate the PRODUCTION database!" -ForegroundColor Red
    $confirm = Read-Host "Are you sure you want to continue? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "❌ Migration cancelled" -ForegroundColor Red
        exit 0
    }

    Write-Host "🚀 Applying migration to production D1..." -ForegroundColor Cyan
    wrangler d1 execute oh8oh-db --file="$($MigrationFile.FullName)"
} else {
    Write-Host "🔧 Applying migration to development D1..." -ForegroundColor Cyan
    wrangler d1 execute oh8oh-db-dev --local --file="$($MigrationFile.FullName)"
}

Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
