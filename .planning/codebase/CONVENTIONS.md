# Coding Conventions

**Analysis Date:** 2026-07-13

## Naming Patterns

**Files:**
- **Route files:** Use React Router file-based routing convention — filenames map to URL paths
  - Example: `app/routes/app._index.tsx` → `/app/` route
  - Example: `app/routes/auth.login/route.tsx` → `/auth/login` route
  - Example: `app/routes/webhooks.app.uninstalled.tsx` → webhook handler route
- **Environment-specific files:** Suffix with `.server` (Node.js/server-only) or `.client` (browser-only)
  - Example: `app/db.server.ts` — database client, runs only on server
  - Example: `app/entry.server.tsx` — server entry point
  - Example: `app/shopify.server.ts` — Shopify API initialization (server-only)
- **General files:** `camelCase` with descriptive names, no hyphens
  - Example: `shopify.server.ts`, `db.server.ts`, `routes.ts`

**Functions:**
- **Export functions:** `camelCase` for regular functions and handlers
  - Example: `loader`, `action` (React Router conventions)
  - Example: `handleRequest` (async request handlers)
- **Component functions:** `PascalCase` for React components (always exported as default)
  - Example: `export default function Index() { ... }` in `app/routes/app._index.tsx`
  - Example: `export default function App() { ... }` in `app/root.tsx`
- **Error boundaries:** `ErrorBoundary` (PascalCase, standard React Router pattern)
- **Utilities:** `camelCase` for helper functions
  - Example: `generateProduct`, `isLoading`

**Variables:**
- **Constants:** `camelCase` for local constants and state
  - Example: `streamTimeout`, `color`, `userAgent`
- **Boolean variables:** Prefix with `is` when appropriate
  - Example: `isLoading = ["loading", "submitting"].includes(fetcher.state)`
- **Global Prisma singleton:** `prismaGlobal` (camelCase with descriptive name)

**Types:**
- **Type imports:** Use explicit `type` keyword for type-only imports
  - Pattern: `import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";`
  - Pattern: `import type { HeadersFunction } from "react-router";`
- **TypeScript interfaces:** Not observed in codebase — types come from library exports
- **Exported types:** When needed, use PascalCase
  - Inferred from usage: Would be `type MyType = { ... }`

## Code Style

**Formatting:**
- **Line length:** Standard (appears to follow Prettier default of 80-88 characters)
- **Indentation:** 2 spaces (inferred from Prettier defaults)
- **Quotes:** Double quotes for strings (standard Prettier default)
- **Semicolons:** Present (Prettier adds them by default)
- **Trailing commas:** Present in multi-line structures (Prettier behavior)

**Linting:**
- **Tool:** ESLint 8.57.1
- **Parser:** `@typescript-eslint/parser` for TypeScript files
- **Extends:** `eslint:recommended` base + React + React Hooks + JSX-a11y + TypeScript + Import plugins
- **Config file:** `.eslintrc.cjs` (CommonJS format for Node.js compatibility)
- **Key rules enforced:**
  - React hooks rules via `eslint-plugin-react-hooks`
  - JSX accessibility rules via `eslint-plugin-jsx-a11y`
  - Proper TypeScript usage via `@typescript-eslint/eslint-plugin`
  - Import ordering and resolution via `eslint-plugin-import`
  - `forceConsistentCasingInFileNames: true` in TypeScript config
  - Strict mode enabled in TypeScript

**Formatting tool:**
- **Tool:** Prettier 3.6.2 (no explicit config file — uses defaults)
- **Prettier ignore:** `.prettierignore` file exists, excludes: `package.json`, `.shadowenv.d`, `.vscode`, `node_modules`, `prisma`, `public`, `.shopify`
- **Settings:** Default Prettier configuration (2-space indent, double quotes, semicolons, 80-char printWidth)

## Import Organization

**Order:**
1. **Node.js/standard library imports** — `import { PassThrough } from "stream";`
2. **External packages** — `import React` (framework), `import { useEffect } from "react";`
3. **External packages continued** — Framework-specific: `import { Links, Meta, ... } from "react-router";`
4. **External packages (third-party SDKs)** — `import { useAppBridge } from "@shopify/app-bridge-react";`
5. **Internal imports** — Relative paths from project: `import { authenticate } from "../shopify.server";`
6. **Internal imports (utilities)** — `import prisma from "./db.server";`

**Path Aliases:**
- No path aliases configured in observable code
- Relative imports used throughout (`../`, `./`)
- TypeScript config has `baseUrl: "."` but no `paths` mapping defined — bare relative paths are the convention

**Import style:**
- **Named imports:** Preferred for multiple imports
  - Pattern: `import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";`
- **Type imports:** Always use `import type { ... }`
  - Pattern: `import type { LoaderFunctionArgs, HeadersFunction } from "react-router";`
- **Default imports:** Used when appropriate
  - Pattern: `import prisma from "./db.server";`
  - Pattern: `import shopify from "./shopify.server";`
- **Star imports:** Observed in one case for GraphQL
  - Pattern: `#graphql` (GraphQL string literal, not an import)

## Error Handling

**Patterns:**
- **Async errors:** Wrapped in `try`-`catch` in loaders/actions, then thrown with React Router
  - Observed: `await authenticate.admin(request)` can throw; errors propagate to error boundary
- **Error boundaries:** `ErrorBoundary` component catches errors from loaders and components
  - Pattern: Uses Shopify's `boundary.error(useRouteError())` for consistent error UI
- **Data extraction:** Non-null assertions used when data shape is known
  - Pattern: `responseJson!.data!.productCreate!.product!`
  - Pattern: `const variantId = product.variants.edges[0]!.node!.id!;`
  - Reasoning: Data comes from GraphQL API with known structure; asserts certainty
- **Graceful null checks:** Where uncertainty exists, explicit checks
  - Pattern: `fetcher.data?.product?.id` (optional chaining)
  - Pattern: `process.env.SHOPIFY_API_SECRET || ""` (fallback to empty string)

## Logging

**Framework:** No explicit logging library observed — uses standard `console.error()`

**Patterns:**
- **Error logging:** `console.error(error)` in error callbacks (`onError` handler in `entry.server.tsx`)
- **Environment variables:** No debug logging observed; Shopify SDK handles its own logging
- **Best practice inferred:** Use `console` for development, structured logging for production (not yet implemented)

## Comments

**When to Comment:**
- **Inline explanations:** For non-obvious React Router or Shopify patterns
  - Example: `// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.`
- **TODO/FIXME:** Not observed in codebase (none found via grep)
- **JSDoc:** Not extensively used — TypeScript types serve as documentation
- **Complex logic:** Brief inline comments where intent isn't obvious from code
  - Example: Comment explaining bot detection callback choice in `entry.server.tsx`

**Inline comments:**
- Use `//` for single-line comments before or at end of line
- Sparingly — code should be self-documenting through naming and types
- Example: `// eslint-disable-next-line no-undef` before accessing `process.env` in browser context

**Type comments:**
- Not used — rely on TypeScript type annotations instead
- Example: `LoaderFunctionArgs`, `ActionFunctionArgs` make intent clear without comments

## Function Design

**Size:** 
- **Maximum observed:** ~360 lines (app/routes/app._index.tsx) — component with UI + GraphQL mutations
- **Typical:** 10-50 lines for handlers, 30-100 for components with multiple sections
- **Guideline inferred:** Keep functions focused; extract complex logic to separate functions if >100 lines

**Parameters:**
- **React Router handlers:** Destructure function arguments
  - Pattern: `export const loader = async ({ request }: LoaderFunctionArgs) => { ... }`
  - Pattern: `export const action = async ({ request }: ActionFunctionArgs) => { ... }`
- **Component props:** Not heavily demonstrated (Shopify web components used instead of custom components)
- **Helper functions:** Use descriptive parameter names matching TypeScript types

**Return Values:**
- **Loaders:** Return data object (serializable) or throw Response for redirects
  - Example: `return { apiKey: process.env.SHOPIFY_API_KEY || "" };`
  - Example: `return null;` (when no data needed)
- **Actions:** Return data object for mutation results or JSON for responses
  - Example: `return { product, variant, metaobject };`
- **Components:** Return JSX or elements
  - Pattern: `return ( <html>...</html> );`
  - Pattern: `return <AppProvider>...</AppProvider>;`
- **Async functions:** Use `async`/`await`, not callbacks
  - Pattern: `export const loader = async ({ request }: LoaderFunctionArgs) => { ... }`

## Module Design

**Exports:**
- **Named exports:** For utilities and re-exported values
  - Example: `export const authenticate = shopify.authenticate;`
  - Example: `export const apiVersion = ApiVersion.October25;`
- **Default exports:** For route components and main modules
  - Example: `export default function App() { ... }` in route files
  - Example: `export default shopify;` in `shopify.server.ts`
  - Example: `export default prisma;` in `db.server.ts`
- **Mixed:** Common in route files
  - Default export (component) + named exports (loader, action, headers, ErrorBoundary)
  - Example: `app/routes/app.tsx`

**Barrel Files:**
- Not observed in codebase (no `index.ts` re-exporting modules)
- React Router file-based routing makes traditional barrel files unnecessary

**Server vs. Client code:**
- **`.server.ts` files:** Imported only on server
  - `db.server.ts` — Prisma singleton initialization
  - `shopify.server.ts` — Shopify API client setup
  - `entry.server.tsx` — Server-side React rendering entry
- **Regular `.tsx`:** Can run on both client and server (React Router framework code)
  - Route components execute on server (loaders) and client (UI rendering)

---

*Convention analysis: 2026-07-13*
