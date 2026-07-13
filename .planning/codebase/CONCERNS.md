# Codebase Concerns

**Analysis Date:** 2026-07-13

## Tech Debt

**Prisma Client Singleton Pattern (Development-Only):**
- Issue: The global Prisma client is only cached in development mode; production creates a new instance on every route execution
- Files: `app/db.server.ts`
- Impact: Potential connection pool exhaustion, resource leaks, and performance degradation in production as multiple PrismaClient instances accumulate
- Fix approach: Apply singleton pattern consistently across all environments (development and production) to reuse the same database connection pool

**Missing Environment Variable Validation:**
- Issue: Critical environment variables (`SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SHOPIFY_API_KEY`) default to empty strings instead of failing early with clear error messages
- Files: `app/shopify.server.ts` (lines 11-12, 15), `app/routes/app.tsx` (line 12)
- Impact: App starts successfully but fails silently at runtime when these credentials are missing; hard to debug production issues
- Fix approach: Add explicit validation at startup to throw descriptive errors if required env vars are missing; use either assert or throw in initialization code

**Unsafe Non-null Assertions:**
- Issue: Multiple locations use TypeScript non-null assertions (`!`) without prior validation
- Files: `vite.config.ts` (line 33), `app/routes/app._index.tsx` (lines 65-66, 88, 130-137)
- Impact: Allows potential null/undefined values to slip through; especially in vite.config.ts where `parseInt(process.env.FRONTEND_PORT!) || 8002` will throw if env var is unset (the fallback won't execute)
- Fix approach: Replace assertions with proper type guards or optional chaining; validate GraphQL responses before accessing nested properties

## Known Bugs

**Scope Storage Format Issue:**
- Symptoms: Scopes stored as comma-separated strings may not round-trip correctly or match expected format
- Files: `app/routes/webhooks.app.scopes_update.tsx` (line 16)
- Trigger: When app scopes are updated via webhook
- Workaround: Manually convert stored scope string back to array format when reading
- Fix: Use `JSON.stringify(current)` instead of `current.toString()` to preserve array structure; update reading code to parse with `JSON.parse()`

**Unsafe Type Assertion in Webhook Payload:**
- Symptoms: App crashes if webhook payload structure doesn't match expected format
- Files: `app/routes/webhooks.app.scopes_update.tsx` (line 9)
- Trigger: If Shopify sends a scopes_update webhook with unexpected payload structure
- Workaround: None currently; would fail at runtime
- Fix: Add runtime validation (e.g., using Zod or simple type guards) to check `payload.current` is actually an array before asserting as `string[]`

## Security Considerations

**Empty String Defaults for Secrets:**
- Risk: Application initializes successfully with empty Shopify credentials, making it harder to catch missing configuration in production
- Files: `app/shopify.server.ts` (line 12 for `apiSecretKey`)
- Current mitigation: Shopify SDK likely validates these at runtime, but error handling is not explicit
- Recommendations: 
  - Add explicit throws for missing `SHOPIFY_API_SECRET` with descriptive message
  - Do not allow empty string defaults for any credential fields
  - Add startup validation that logs all required env vars before server starts

**Webhook Without Error Handling:**
- Risk: Database errors during webhook processing are not logged or reported, making it hard to detect if webhooks failed silently
- Files: `app/routes/webhooks.app.scopes_update.tsx` (lines 11-18), `app/routes/webhooks.app.uninstalled.tsx` (lines 12-14)
- Current mitigation: None visible
- Recommendations:
  - Wrap database operations in try-catch blocks
  - Log errors with context (shop, topic, error message)
  - Consider returning error status codes (500) instead of 200 if operations fail, so Shopify can retry

## Performance Bottlenecks

**Multiple Sequential GraphQL Calls:**
- Problem: The main dashboard action makes 3 sequential GraphQL API calls without parallelization
- Files: `app/routes/app._index.tsx` (lines 23, 68, 90)
- Cause: Each `admin.graphql()` call awaits response before starting the next one; creates artificial latency
- Improvement path: Use `Promise.all()` to execute the three mutations in parallel (if they don't depend on each other's results), cutting response time by 2/3

**Hardcoded Stream Timeout:**
- Problem: React render-to-stream timeout is hardcoded to 6000ms; cannot be adjusted without code change
- Files: `app/entry.server.tsx` (line 55)
- Cause: `setTimeout(abort, streamTimeout + 1000)` uses fixed 6000ms timeout
- Improvement path: Make timeout configurable via environment variable or config; document timeout behavior; consider async boundaries for slow components

## Fragile Areas

**GraphQL Response Parsing:**
- Files: `app/routes/app._index.tsx` (lines 63, 88, 130)
- Why fragile: Response is immediately accessed with nested non-null assertions without checking for GraphQL-level errors (userErrors field)
  - Line 63: `responseJson.data!.productCreate!.product!` assumes success
  - Line 88: `variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants` assumes variant update succeeds
  - Line 130: `metaobjectResponseJson!.data!.metaobjectUpsert!.metaobject` assumes upsert succeeds
- Safe modification: 
  1. Check `responseJson.errors` array exists and is empty before accessing data
  2. Check `userErrors` array in mutation responses (line 104-107 shows it exists)
  3. Extract a helper function `validateGraphQLResponse(response, operationName)` to centralize this logic
- Test coverage: No visible test files for GraphQL mutation handling

**Environment Variable Access:**
- Files: `app/shopify.server.ts`, `vite.config.ts`, `app/routes/app.tsx`
- Why fragile: Multiple locations read environment variables without centralized validation; changes to env var requirements are easy to miss
- Safe modification: Create a single `env.server.ts` module that validates and exports all required environment variables with clear error messages; import from that module everywhere else
- Test coverage: No validation tests for missing environment variables

## Scaling Limits

**Single SQLite Database:**
- Current capacity: SQLite `file:dev.sqlite` is local file-based; limited to single process access
- Limit: As soon as you scale to multiple app instances (horizontal scaling), SQLite will become a bottleneck with write contention
- Scaling path: 
  1. For staging/production, migrate to PostgreSQL or managed database (e.g., AWS RDS, Render)
  2. Update `datasource db { provider = "postgresql" }` in Prisma schema
  3. Set DATABASE_URL environment variable pointing to managed database

**HMR Port Hardcoded:**
- Current capacity: Vite HMR uses port 64999 for localhost, fixed port per deployment
- Limit: Cannot run multiple instances of the dev server locally; port conflicts will cause HMR failures
- Scaling path: Make HMR port configurable via environment variable (e.g., `HMR_PORT`)

## Dependencies at Risk

**Prisma Version 6.x:**
- Risk: Breaking change potential in minor versions; Prisma 6.16.3 is a recent minor release
- Impact: Schema generation and client library changes between 6.x versions could break migrations
- Migration plan: 
  - Test all Prisma commands (migrate, generate, seed) before upgrading minor versions
  - Pin to exact version in package.json instead of caret (`^6.16.3` → `6.16.3`)
  - Keep an eye on Prisma release notes for breaking changes

**React Router 7.12.0:**
- Risk: Early version of React Router 7 series; potential for breaking changes or missing features in 7.13+
- Impact: Loader/action API changes or type changes could break routes
- Migration plan: Review React Router changelog before upgrading minor versions; test all routes thoroughly

**Node.js Version Range:**
- Risk: Supports Node 20.19+, 22.12+ but excludes 21.x and other intermediate versions
- Impact: CI/CD pipelines must match these exact ranges or builds will fail unexpectedly
- Migration plan: Document supported versions clearly in README; use `.nvmrc` or `.node-version` file to pin dev environment

## Test Coverage Gaps

**No Webhook Tests:**
- What's not tested: Webhook handlers for `scopes_update` and `app.uninstalled` events
- Files: `app/routes/webhooks.app.scopes_update.tsx`, `app/routes/webhooks.app.uninstalled.tsx`
- Risk: Webhook logic could break silently; database cleanup might not happen on uninstall
- Priority: High

**No GraphQL Mutation Tests:**
- What's not tested: Product creation, variant update, metaobject upsert mutations in dashboard
- Files: `app/routes/app._index.tsx`
- Risk: GraphQL errors or malformed responses are not handled; mutations could fail silently to users
- Priority: High

**No Environment Variable Validation Tests:**
- What's not tested: Startup behavior when required env vars are missing
- Files: `app/shopify.server.ts`, `vite.config.ts`
- Risk: Configuration errors are not caught until runtime; hard to debug in production
- Priority: Medium

**No Authentication Tests:**
- What's not tested: Login flow, session management, scope changes
- Files: `app/routes/auth.login/route.tsx`, `app/routes/auth.login/error.server.tsx`
- Risk: Auth failures or edge cases could block users from logging in
- Priority: High

---

*Concerns audit: 2026-07-13*
