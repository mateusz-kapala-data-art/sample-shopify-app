<!-- refreshed: 2026-07-13 -->
# Architecture

**Analysis Date:** 2026-07-13

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                                 │
│                  Polaris Web Components + React                          │
│                    `app/routes/*.tsx` Components                         │
└────────────────────────────────────┬────────────────────────────────────┘
         │
         │ HTTP/WebSocket
         │
┌────────▼─────────────────────────────────────────────────────────────────┐
│                      Server (React Router)                               │
│                     `app/entry.server.tsx`                               │
│  Loader/Action Functions | Authentication | Session Management          │
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         ├──────────────────────┬──────────────────────┬──────────────────┐
         │                      │                      │                  │
         ▼                      ▼                      ▼                  ▼
   ┌──────────────┐      ┌─────────────────┐  ┌──────────────┐   ┌────────────┐
   │ Shopify API  │      │  Database       │  │    Session   │   │   Error    │
   │  (GraphQL)   │      │  (Prisma +      │  │   Storage    │   │  Boundary  │
   │              │      │   SQLite)       │  │  (Prisma)    │   │            │
   `app/routes`  │      │  `db.server.ts` │  │              │   │`boundary.  │
   GraphQL ops   │      │ `prisma/schema` │  │ Session model│   │error()`    │
   └──────────────┘      └─────────────────┘  └──────────────┘   └────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root Layout | Render HTML document, load styles, link Shopify CDN | `app/root.tsx` |
| Server Entry | Handle SSR, stream rendering, attach Shopify headers | `app/entry.server.tsx` |
| Shopify Config | Initialize Shopify app, OAuth, session storage | `app/shopify.server.ts` |
| Database Client | Prisma singleton with reuse in dev mode | `app/db.server.ts` |
| Protected Routes | App navigation, authenticated pages | `app/routes/app.tsx` |
| Public Routes | Login page, index page, webhooks | `app/routes/auth.*.tsx`, `app/routes/_index/`, `app/routes/webhooks.*` |

## Pattern Overview

**Overall:** Full-stack Shopify embedded app using React Router v7 with file-based routing.

**Key Characteristics:**
- React Router handles both routing and request/response processing (loaders/actions)
- Server-side rendering with streaming for fast paint times
- Shopify authentication layer intercepts all admin routes
- Prisma ORM manages database and session storage
- GraphQL-based data operations with Shopify Admin API
- Embedded app runs within Shopify admin iframe using App Bridge

## Layers

**Presentation Layer:**
- Purpose: Render UI components using Polaris web components
- Location: `app/routes/*.tsx`
- Contains: Route components, loaders (data fetching), actions (mutations)
- Depends on: Shopify authentication, database queries, App Bridge
- Used by: Browsers via HTTP

**Server Request Handling Layer:**
- Purpose: Authenticate requests, manage sessions, coordinate data access
- Location: `app/entry.server.tsx`, loader/action functions in routes
- Contains: Server-side rendering, request authentication, error boundaries
- Depends on: Shopify session storage, Prisma database
- Used by: Presentation layer and external webhooks

**Authentication & Session Layer:**
- Purpose: Handle OAuth flow, validate sessions, manage app-to-shop authorization
- Location: `app/shopify.server.ts`
- Contains: Shopify app initialization, authentication middleware, session config
- Depends on: Environment variables (API key, secret, scopes)
- Used by: All protected routes via `authenticate.admin()` or `authenticate.webhook()`

**Data Access Layer:**
- Purpose: Query/mutate Shopify resources and local data
- Location: Route loaders/actions via `admin.graphql()`, Prisma queries
- Contains: GraphQL operations, database operations
- Depends on: Shopify Admin API, SQLite database (via Prisma)
- Used by: Server request handling layer

**Database Layer:**
- Purpose: Persist session data and custom application data
- Location: `prisma/schema.prisma`, `app/db.server.ts`
- Contains: Schema definitions, migrations
- Depends on: SQLite file at `dev.sqlite`
- Used by: Session storage, application data queries

## Data Flow

### Primary Request Path (Authenticated Admin Route)

1. Browser requests `/app/products` → React Router receives request
2. Route loader `authenticate.admin(request)` checks session validity (`app/routes/app.tsx` line 8)
3. Shopify middleware validates token against Prisma session storage (`app/db.server.ts`)
4. Loader fetches data via `admin.graphql()` — sends query to Shopify API (`app/routes/app._index.tsx` lines 23-62)
5. Prisma Query Client executes against SQLite, returns Session data
6. Component renders with data, sends HTML stream back to browser
7. Browser loads Polaris components via Shopify CDN (`app/root.tsx` lines 9-12)
8. App Bridge connects embedded app to Shopify admin context

### Webhook Path (Async Event from Shopify)

1. Shopify sends POST to `/webhooks/app/uninstalled` (topic: `app/uninstalled`)
2. Route action `authenticate.webhook(request)` validates webhook signature (`app/routes/webhooks.app.uninstalled.tsx` line 6)
3. Extracts shop name and session from request (`app/routes/webhooks.app.uninstalled.tsx` line 6)
4. Prisma deletes session records for that shop (`app/routes/webhooks.app.uninstalled.tsx` line 13)
5. Returns `200 OK` to acknowledge receipt

### Authentication Flow (First-Time Login)

1. User visits app URL → Redirected to `/auth/login` (public route)
2. User enters shop domain → Form POST to `/auth/login`
3. `authenticate.login()` initiates OAuth redirect to Shopify (`app/routes/auth.login/route.tsx` line 16)
4. Shopify redirects back to app with authorization code
5. Middleware exchanges code for access token
6. Session created in Prisma storage (`app/shopify.server.ts` line 17)
7. Redirects user to `/app` (now authenticated)

**State Management:**
- Session state: Stored in SQLite via Prisma (`app/db.server.ts`)
- Request state: Passed through React Router context (`app/entry.server.tsx`)
- Client state: React component state (useState hooks)
- App context: Shopify App Bridge provides shop/user context to embedded app

## Key Abstractions

**Authenticated Request:**
- Purpose: Ensure requests come from authorized Shopify merchants
- Examples: `authenticate.admin()` in protected routes, `authenticate.webhook()` for webhook handlers
- Pattern: Middleware that validates session + OAuth token validity

**Admin GraphQL Client:**
- Purpose: Typed, authenticated access to Shopify Admin API
- Examples: `admin.graphql()` in `app/routes/app._index.tsx` lines 23-47
- Pattern: Returns Response object, caller must `.json()` and extract data

**Prisma Session Storage:**
- Purpose: Persist Shopify OAuth sessions in database
- Examples: Session model in `prisma/schema.prisma` lines 16-34
- Pattern: `PrismaSessionStorage` injected into shopifyApp config

**Error Boundary:**
- Purpose: Catch thrown responses and render error UI
- Examples: `boundary.error(useRouteError())` in `app/routes/app.tsx` line 31
- Pattern: Shopify-provided wrapper around React Router error handling

## Entry Points

**Web Entry (Embedded App):**
- Location: `app/root.tsx`
- Triggers: Browser requests to `/` or any app route
- Responsibilities: Render root HTML document, attach metadata and stylesheets

**App Route Entry (Authenticated Pages):**
- Location: `app/routes/app.tsx`
- Triggers: Browser requests to `/app/*` after authentication
- Responsibilities: Authenticate request, wrap routes in AppProvider, render navigation

**Auth Entry (Login Page):**
- Location: `app/routes/auth.login/route.tsx`
- Triggers: Unauthenticated user tries to access protected route
- Responsibilities: Render login form, handle shop domain submission

**Webhook Entries:**
- Locations: `app/routes/webhooks.app.uninstalled.tsx`, `app/routes/webhooks.app.scopes_update.tsx`
- Triggers: Shopify sends POST to configured webhook URIs
- Responsibilities: Verify webhook signature, process event, update local state

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop. Database queries are async. Heavy operations block the event loop; use worker threads for CPU-intensive tasks (not currently used).
- **Global state:** `db.server.ts` maintains a module-level Prisma singleton reused across requests in development mode. In production, `new PrismaClient()` is created once. This prevents connection pool exhaustion in dev hot-reloads.
- **Circular imports:** None detected in current structure.
- **OAuth token lifecycle:** Tokens expire and must be refreshed. Shopify middleware handles refresh automatically before requests; expired sessions are cleared by webhook handler.
- **Embedded app context:** App only works within Shopify admin iframe. Public pages (login) run unembed (AppProvider embedded={false}).
- **Database concurrency:** SQLite has basic locking; not recommended for high-concurrency production. Upgrade to PostgreSQL/MySQL for scaling.

## Anti-Patterns

### Unvalidated Webhook Processing

**What happens:** If webhook signature validation is skipped, malicious actors can spoof Shopify events and trigger actions.
**Why it's wrong:** Session deletion, data mutations, or resource cleanup could be triggered by unauthorized requests, compromising merchant data.
**Do this instead:** Always call `authenticate.webhook(request)` before processing webhook payloads. Shopify middleware validates HMAC signature automatically (`app/routes/webhooks.app.uninstalled.tsx` line 6).

### Bypassing Session Validation

**What happens:** Directly accessing admin API without calling `authenticate.admin()` would send requests without valid OAuth token.
**Why it's wrong:** Shopify API rejects requests without valid session; requests fail. More importantly, it skips merchant authorization checks.
**Do this instead:** All protected routes call `authenticate.admin(request)` in loader/action. This validates session and injects authenticated admin client into context (`app/routes/app.tsx` line 9, `app/routes/app._index.tsx` line 19).

### Blocking Event Loop in Loaders

**What happens:** If a loader performs synchronous heavy computation (e.g., image processing, large loops) or waits for network I/O without async/await, the entire server stalls and no other requests are processed.
**Why it's wrong:** Other merchants' requests timeout; app becomes unresponsive during slow operations.
**Do this instead:** Always use async/await for I/O (GraphQL, database). Offload CPU-bound work to worker threads or message queues.

## Error Handling

**Strategy:** React Router boundary catches thrown responses. Shopify provides boundary wrapper for proper header forwarding.

**Patterns:**
- Authentication failures (invalid token, expired session) → redirects to `/auth/login`
- GraphQL errors (insufficient scopes, invalid query) → caught in action, returned to component, user sees error toast
- Database errors (connection loss, constraint violations) → caught in try-catch, logged to console, user sees 500 error via boundary
- Webhook validation failures (invalid signature) → return 401, Shopify retries

## Cross-Cutting Concerns

**Logging:** `console.log()` for webhook events (`app/routes/webhooks.app.uninstalled.tsx` line 8). No structured logging framework configured. Errors logged to console in entry server error handlers (`app/entry.server.tsx` line 48).

**Validation:** 
- Form validation in login component via HTML5 attributes (`app/routes/auth.login/route.tsx` lines 34-42)
- GraphQL response validation implicit in type safety (TypeScript)
- Webhook signature validation via Shopify middleware

**Authentication:** Handled entirely by `shopify.server.ts` exported functions (`authenticate.admin()`, `authenticate.webhook()`, `authenticate.login()`).

---

*Architecture analysis: 2026-07-13*
