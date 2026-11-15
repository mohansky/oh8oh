# ==================================
# TURSO DATABASE
# ==================================
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token

# ==================================
# AUTH (Better Auth)
# ==================================
BETTER_AUTH_SECRET=your_secret_key_here
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# Passkeys
PASSKEY_RP_ID=localhost
PASSKEY_ORIGIN=http://localhost:3000

# ==================================
# RESEND (Email Verification)
# ==================================
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=App Name <noreply@yourdomain.com>
CONTACT_NOTIFICATION_EMAIL=you@yourdomain.com

# ==================================
# CLOUDFLARE R2 (Image Uploads)
# ==================================
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=event-app
R2_PUBLIC_URL=https://your-r2-public-url.r2.dev
