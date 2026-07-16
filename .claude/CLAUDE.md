<!-- GSD:project-start source:PROJECT.md -->

## Project

**Sony Platform App (Demo)**

A Shopify embedded app built as a **live-presentation teaching artifact**. It demonstrates a "platform app" pattern — a single custom app that self-registers stores into a central registry, verifies webhooks with rotatable secrets, mints admin tokens via client credentials, and manages per-store modules at runtime. It is run on stage by a presenter to anchor the claims of an accompanying deck ("Presentation Spec v2") in honest, working code, and to power six live demos (plus one optional Claude-connector demo).

The base is the standard Shopify React Router template (TypeScript, Prisma/SQLite, Polaris, App Bridge, OAuth + webhooks) — the plumbing is real; the platform-app product on top of it is what this project builds.

**Core Value:** Every crucial claim in the deck has a visible, working anchor in code or on screen, and the six live demos run reliably on stage. Demo-first, not production-first: honest patterns, no fakes, optimized for visibility (small files, loud waypoint comments, obvious names).

### Constraints

- **Timeline**: Live presentation under 2 weeks out — prioritize the demo-critical path; minimize anything not on a slide.
- **Tech stack**: Shopify React Router template (TypeScript, React 18, React Router 7, Prisma 6/SQLite, Polaris web components, App Bridge) — do not hand-roll structure; match the template so audience file paths line up.
- **API version**: Shopify `2026-07` (webhooks and Functions pin to it).
- **Operational**: Do not rotate the client secret in the week before the session (webhook HMAC signing can lag up to an hour after rotation). Never touch production stores/app records during the session.
- **Stage reliability**: Every payoff state must be pre-built (git tag, prepared store, or pre-created app version) — nothing improvised live. Screenshot fallbacks for every payoff moment.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.9.3 - Full codebase, frontend and backend
- JSX - React components
- JavaScript - Configuration files (CommonJS modules)
- TOML - Shopify app configuration

## Runtime

- Node.js 20.19 - 22.x (see `package.json` engines constraint)
- npm - Primary package manager
- pnpm - Workspace support (via `pnpm-workspace.yaml`)
- Lockfile: `package-lock.json` (present)

## Frameworks

- React 18.3.1 - UI framework for client-side components
- React Router 7.12.0 - Full-stack routing and application framework
- `@shopify/app-bridge-react` 4.2.4 - Shopify Admin UI integration
- `@shopify/shopify-app-react-router` 1.1.0 - Shopify app authentication and middleware
- `@shopify/shopify-app-session-storage-prisma` 9.0.0 - Shopify session storage backed by Prisma
- Prisma 6.16.3 - ORM for SQLite and database migrations
- Vite 6.3.6 - Frontend build tool and dev server
- `react-router` CLI - Used for build scripts (see `package.json` scripts)
- ESLint 8.57.1 - Linting with TypeScript and React support
- Prettier 3.6.2 - Code formatter (no dedicated config file, uses defaults)

## Key Dependencies

- React Router - Powers all routing and full-stack rendering
- Shopify App Bridge - Enables embedded admin UI integration
- Prisma - Manages database schema, migrations, and client access
- `@shopify/api-codegen-preset` 1.2.0 - Generates TypeScript types for Shopify Admin API
- `isbot` 5.1.31 - Bot detection for user agents
- React DOM 18.3.1 - React rendering engine

## Configuration

- Configured via `process.env` variables (see `app/shopify.server.ts`)
- `vite.config.ts` - Vite configuration with React Router and TypeScript paths
- `tsconfig.json` - TypeScript compiler options (strict mode enabled, ES2022 target)
- `.eslintrc.cjs` - ESLint configuration with React and TypeScript rules
- `.graphqlrc.ts` - GraphQL code generation config for Shopify Admin API
- `shopify.app.toml` - App metadata, webhooks, scopes, metafield definitions
- `shopify.web.toml` - Web role configuration, predev and dev commands

## Platform Requirements

- Node.js 20.19 or higher
- npm or pnpm
- OpenSSL (bundled in Docker image)
- Shopify CLI (for `shopify app dev`, `shopify app deploy` commands)
- Docker support (Alpine Linux + Node.js 20)
- Node.js runtime
- Database: SQLite or compatible database (configurable via Prisma)
- Environment variables for Shopify API credentials

## Notes

- **TypeScript Strict Mode:** Enabled in `tsconfig.json` for type safety
- **React JSX Runtime:** Uses automatic JSX transform (no `React.createElement` calls needed)
- **Database:** Defaults to SQLite (`prisma/schema.prisma` with `file:dev.sqlite`), configurable for production databases via Prisma datasource
- **Vite HMR:** Configured for both local development and remote deployment scenarios
- **Workspace:** Supports extensions via `pnpm-workspace.yaml` (currently empty, see `extensions/.gitkeep`)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- **Route files:** Use React Router file-based routing convention — filenames map to URL paths
- **Environment-specific files:** Suffix with `.server` (Node.js/server-only) or `.client` (browser-only)
- **General files:** `camelCase` with descriptive names, no hyphens
- **Export functions:** `camelCase` for regular functions and handlers
- **Component functions:** `PascalCase` for React components (always exported as default)
- **Error boundaries:** `ErrorBoundary` (PascalCase, standard React Router pattern)
- **Utilities:** `camelCase` for helper functions
- **Constants:** `camelCase` for local constants and state
- **Boolean variables:** Prefix with `is` when appropriate
- **Global Prisma singleton:** `prismaGlobal` (camelCase with descriptive name)
- **Type imports:** Use explicit `type` keyword for type-only imports
- **TypeScript interfaces:** Not observed in codebase — types come from library exports
- **Exported types:** When needed, use PascalCase

## Code Style

- **Line length:** Standard (appears to follow Prettier default of 80-88 characters)
- **Indentation:** 2 spaces (inferred from Prettier defaults)
- **Quotes:** Double quotes for strings (standard Prettier default)
- **Semicolons:** Present (Prettier adds them by default)
- **Trailing commas:** Present in multi-line structures (Prettier behavior)
- **Tool:** ESLint 8.57.1
- **Parser:** `@typescript-eslint/parser` for TypeScript files
- **Extends:** `eslint:recommended` base + React + React Hooks + JSX-a11y + TypeScript + Import plugins
- **Config file:** `.eslintrc.cjs` (CommonJS format for Node.js compatibility)
- **Key rules enforced:**
- **Tool:** Prettier 3.6.2 (no explicit config file — uses defaults)
- **Prettier ignore:** `.prettierignore` file exists, excludes: `package.json`, `.shadowenv.d`, `.vscode`, `node_modules`, `prisma`, `public`, `.shopify`
- **Settings:** Default Prettier configuration (2-space indent, double quotes, semicolons, 80-char printWidth)

## Import Organization

- No path aliases configured in observable code
- Relative imports used throughout (`../`, `./`)
- TypeScript config has `baseUrl: "."` but no `paths` mapping defined — bare relative paths are the convention
- **Named imports:** Preferred for multiple imports
- **Type imports:** Always use `import type { ... }`
- **Default imports:** Used when appropriate
- **Star imports:** Observed in one case for GraphQL

## Error Handling

- **Async errors:** Wrapped in `try`-`catch` in loaders/actions, then thrown with React Router
- **Error boundaries:** `ErrorBoundary` component catches errors from loaders and components
- **Data extraction:** Non-null assertions used when data shape is known
- **Graceful null checks:** Where uncertainty exists, explicit checks

## Logging

- **Error logging:** `console.error(error)` in error callbacks (`onError` handler in `entry.server.tsx`)
- **Environment variables:** No debug logging observed; Shopify SDK handles its own logging
- **Best practice inferred:** Use `console` for development, structured logging for production (not yet implemented)

## Comments

- **Inline explanations:** For non-obvious React Router or Shopify patterns
- **TODO/FIXME:** Not observed in codebase (none found via grep)
- **JSDoc:** Not extensively used — TypeScript types serve as documentation
- **Complex logic:** Brief inline comments where intent isn't obvious from code
- Use `//` for single-line comments before or at end of line
- Sparingly — code should be self-documenting through naming and types
- Example: `// eslint-disable-next-line no-undef` before accessing `process.env` in browser context
- Not used — rely on TypeScript type annotations instead
- Example: `LoaderFunctionArgs`, `ActionFunctionArgs` make intent clear without comments

## Function Design

- **Maximum observed:** ~360 lines (app/routes/app._index.tsx) — component with UI + GraphQL mutations
- **Typical:** 10-50 lines for handlers, 30-100 for components with multiple sections
- **Guideline inferred:** Keep functions focused; extract complex logic to separate functions if >100 lines
- **React Router handlers:** Destructure function arguments
- **Component props:** Not heavily demonstrated (Shopify web components used instead of custom components)
- **Helper functions:** Use descriptive parameter names matching TypeScript types
- **Loaders:** Return data object (serializable) or throw Response for redirects
- **Actions:** Return data object for mutation results or JSON for responses
- **Components:** Return JSX or elements
- **Async functions:** Use `async`/`await`, not callbacks

## Module Design

- **Named exports:** For utilities and re-exported values
- **Default exports:** For route components and main modules
- **Mixed:** Common in route files
- Not observed in codebase (no `index.ts` re-exporting modules)
- React Router file-based routing makes traditional barrel files unnecessary
- **`.server.ts` files:** Imported only on server
- **Regular `.tsx`:** Can run on both client and server (React Router framework code)

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- React Router handles both routing and request/response processing (loaders/actions)
- Server-side rendering with streaming for fast paint times
- Shopify authentication layer intercepts all admin routes
- Prisma ORM manages database and session storage
- GraphQL-based data operations with Shopify Admin API
- Embedded app runs within Shopify admin iframe using App Bridge

## Layers

- Purpose: Render UI components using Polaris web components
- Location: `app/routes/*.tsx`
- Contains: Route components, loaders (data fetching), actions (mutations)
- Depends on: Shopify authentication, database queries, App Bridge
- Used by: Browsers via HTTP
- Purpose: Authenticate requests, manage sessions, coordinate data access
- Location: `app/entry.server.tsx`, loader/action functions in routes
- Contains: Server-side rendering, request authentication, error boundaries
- Depends on: Shopify session storage, Prisma database
- Used by: Presentation layer and external webhooks
- Purpose: Handle OAuth flow, validate sessions, manage app-to-shop authorization
- Location: `app/shopify.server.ts`
- Contains: Shopify app initialization, authentication middleware, session config
- Depends on: Environment variables (API key, secret, scopes)
- Used by: All protected routes via `authenticate.admin()` or `authenticate.webhook()`
- Purpose: Query/mutate Shopify resources and local data
- Location: Route loaders/actions via `admin.graphql()`, Prisma queries
- Contains: GraphQL operations, database operations
- Depends on: Shopify Admin API, SQLite database (via Prisma)
- Used by: Server request handling layer
- Purpose: Persist session data and custom application data
- Location: `prisma/schema.prisma`, `app/db.server.ts`
- Contains: Schema definitions, migrations
- Depends on: SQLite file at `dev.sqlite`
- Used by: Session storage, application data queries

## Data Flow

### Primary Request Path (Authenticated Admin Route)

### Webhook Path (Async Event from Shopify)

### Authentication Flow (First-Time Login)

- Session state: Stored in SQLite via Prisma (`app/db.server.ts`)
- Request state: Passed through React Router context (`app/entry.server.tsx`)
- Client state: React component state (useState hooks)
- App context: Shopify App Bridge provides shop/user context to embedded app

## Key Abstractions

- Purpose: Ensure requests come from authorized Shopify merchants
- Examples: `authenticate.admin()` in protected routes, `authenticate.webhook()` for webhook handlers
- Pattern: Middleware that validates session + OAuth token validity
- Purpose: Typed, authenticated access to Shopify Admin API
- Examples: `admin.graphql()` in `app/routes/app._index.tsx` lines 23-47
- Pattern: Returns Response object, caller must `.json()` and extract data
- Purpose: Persist Shopify OAuth sessions in database
- Examples: Session model in `prisma/schema.prisma` lines 16-34
- Pattern: `PrismaSessionStorage` injected into shopifyApp config
- Purpose: Catch thrown responses and render error UI
- Examples: `boundary.error(useRouteError())` in `app/routes/app.tsx` line 31
- Pattern: Shopify-provided wrapper around React Router error handling

## Entry Points

- Location: `app/root.tsx`
- Triggers: Browser requests to `/` or any app route
- Responsibilities: Render root HTML document, attach metadata and stylesheets
- Location: `app/routes/app.tsx`
- Triggers: Browser requests to `/app/*` after authentication
- Responsibilities: Authenticate request, wrap routes in AppProvider, render navigation
- Location: `app/routes/auth.login/route.tsx`
- Triggers: Unauthenticated user tries to access protected route
- Responsibilities: Render login form, handle shop domain submission
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

### Bypassing Session Validation

### Blocking Event Loop in Loaders

## Error Handling

- Authentication failures (invalid token, expired session) → redirects to `/auth/login`
- GraphQL errors (insufficient scopes, invalid query) → caught in action, returned to component, user sees error toast
- Database errors (connection loss, constraint violations) → caught in try-catch, logged to console, user sees 500 error via boundary
- Webhook validation failures (invalid signature) → return 401, Shopify retries

## Cross-Cutting Concerns

- Form validation in login component via HTML5 attributes (`app/routes/auth.login/route.tsx` lines 34-42)
- GraphQL response validation implicit in type safety (TypeScript)
- Webhook signature validation via Shopify middleware

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
