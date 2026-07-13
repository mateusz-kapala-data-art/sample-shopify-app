# External Integrations

**Analysis Date:** 2026-07-13

## APIs & External Services

**Shopify Admin API:**
- Service: Shopify Admin GraphQL API
  - SDK/Client: `@shopify/shopify-app-react-router` (handles authentication and GraphQL requests)
  - API Version: October 2025 (see `ApiVersion.October25` in `app/shopify.server.ts` and `shopify.app.toml`)
  - Type: GraphQL API
  - Authentication: OAuth 2.0 via Shopify App Bridge
  - Implementation file: `app/shopify.server.ts`
  - GraphQL Code Generation: `.graphqlrc.ts` for type-safe API calls

**Shopify Store Data:**
- Product operations (write access via scope `write_products`)
- Metaobject operations (write access via scope `write_metaobjects`, `write_metaobject_definitions`)
- Session/User data management

**MCP Integration:**
- Shopify Dev MCP Server
  - Connection: stdio via `.mcp.json`
  - Command: `npx @shopify/dev-mcp@latest`
  - Purpose: Development utilities and local app tunneling

## Data Storage

**Databases:**
- **SQLite (Default Development)**
  - Connection: File-based (`file:dev.sqlite` from `prisma/schema.prisma`)
  - Client: Prisma ORM v6.16.3
  - Configured via: `prisma/schema.prisma` datasource block

**Models:**
- Session model (`prisma/schema.prisma`):
  - Stores Shopify app sessions
  - Fields: id, shop, state, isOnline, scope, expires, accessToken, userId, firstName, lastName, email, accountOwner, locale, collaborator, emailVerified, refreshToken, refreshTokenExpires
  - Used for session persistence and OAuth token management

**File Storage:**
- Not explicitly integrated - uses local filesystem only (static assets via `public/` directory)

**Caching:**
- In-development: Prisma client singleton pattern (see `app/db.server.ts`) for connection pooling
- No external caching service (Redis/Memcached) configured

## Authentication & Identity

**Auth Provider:**
- Shopify OAuth 2.0
  - Implementation: `@shopify/shopify-app-react-router/server`
  - Session Storage: `@shopify/shopify-app-session-storage-prisma` (Prisma-backed)
  - Configuration file: `app/shopify.server.ts`
  - Auth flow:
    1. Redirect to Shopify login via `/auth/login` route (`app/routes/auth.login/route.tsx`)
    2. Callback handled by `/auth/$` catch-all route (`app/routes/auth.$.tsx`)
    3. Session stored in SQLite via Prisma

**Scopes Required (from `shopify.app.toml`):**
- `write_products` - Modify product data
- `write_metaobjects` - Create/modify metaobjects
- `write_metaobject_definitions` - Create/modify metaobject schemas

**Session Handling:**
- Environment variables consumed: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`
- Token types: Access token (online), Refresh token (offline, configured in `app/shopify.server.ts` with `expiringOfflineAccessTokens: true`)

## Webhooks & Callbacks

**Incoming Webhooks (from `shopify.app.toml`):**
- **app/scopes_update** - Topic: `app/scopes_update`
  - Endpoint: `/webhooks/app/scopes_update`
  - Handler: `app/routes/webhooks.app.scopes_update.tsx`
  - Purpose: Notifies when merchant updates app scopes
  
- **app/uninstalled** - Topic: `app/uninstalled`
  - Endpoint: `/webhooks/app/uninstalled`
  - Handler: `app/routes/webhooks.app.uninstalled.tsx`
  - Purpose: Cleans up session data when app is uninstalled

**Webhook API Version:** 2026-10 (see `shopify.app.toml`)

**Webhook Processing:**
- Authenticated via Shopify signature verification (handled by `authenticate.webhook()`)
- Executed as background jobs during HTTP requests
- Session database cleanup on uninstall (see `app/routes/webhooks.app.uninstalled.tsx`)

## Monitoring & Observability

**Error Tracking:**
- None detected - no error tracking service (Sentry, Rollbar, etc.) configured

**Logs:**
- Console logging only (e.g., `console.log()` in webhook handlers)
- Environment-aware: Single instance in development via `global.prismaGlobal` pattern

**Debugging:**
- Development mode supported via Vite HMR (`vite.config.ts` hmrConfig)
- Prisma Studio available via `npm run prisma studio` command

## CI/CD & Deployment

**Hosting:**
- Deployment: Shopify App Platform
- Build command: `npm run build` (React Router build)
- Start command: `npm run docker-start` (runs setup + start)
- Docker support: `Dockerfile` (Alpine Linux, Node.js 20)

**CI Pipeline:**
- Not detected in repo - no GitHub Actions, GitLab CI, or equivalent found

**Environment Setup:**
- Development: `shopify app dev` (CLI command, runs Vite + Prisma migrations)
- Production: Docker container with production build
- Setup steps: `prisma generate` (predev), `prisma migrate deploy` (startup)

## Environment Configuration

**Required env vars:**
- `SHOPIFY_API_KEY` - OAuth client ID from Shopify Partner Dashboard
- `SHOPIFY_API_SECRET` - OAuth client secret
- `SHOPIFY_APP_URL` - Public HTTPS URL where app is accessible
- `SCOPES` - Comma-separated list (e.g., `write_products,write_metaobjects,write_metaobject_definitions`)

**Optional env vars:**
- `SHOP_CUSTOM_DOMAIN` - For custom Shopify shop domains (used in `app/shopify.server.ts`)
- `NODE_ENV` - Environment (development/production, defaults to production in Docker)
- `PORT` - Server listen port (default 3000)
- `FRONTEND_PORT` - Vite HMR port for remote deploys (default 8002)

**Secrets location:**
- Environment variables only - no secrets file committed to repo
- `.env` and `.env.*` patterns in `.gitignore`
- Docker: Passed via environment at runtime

## API Endpoints

**Authentication Endpoints:**
- `/auth/login` - Initiates Shopify OAuth flow (GET/POST)
- `/auth/$` - OAuth callback handler (GET)

**Webhook Endpoints:**
- `/webhooks/app/scopes_update` - Scope update notifications (POST)
- `/webhooks/app/uninstalled` - App uninstall notifications (POST)

**Application Endpoints:**
- `/app` - Main app shell (authenticated via Shopify middleware)
- `/app._index` - Home page
- `/app.additional` - Additional page example
- `/` - Unauthenticated landing page

**Server Type:** Embedded Shopify Admin app (`embedded = true` in `shopify.app.toml`)

---

*Integration audit: 2026-07-13*
