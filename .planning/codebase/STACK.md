# Technology Stack

**Analysis Date:** 2026-07-13

## Languages

**Primary:**
- TypeScript 5.9.3 - Full codebase, frontend and backend
- JSX - React components

**Secondary:**
- JavaScript - Configuration files (CommonJS modules)
- TOML - Shopify app configuration

## Runtime

**Environment:**
- Node.js 20.19 - 22.x (see `package.json` engines constraint)

**Package Manager:**
- npm - Primary package manager
- pnpm - Workspace support (via `pnpm-workspace.yaml`)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- React 18.3.1 - UI framework for client-side components
- React Router 7.12.0 - Full-stack routing and application framework
  - `@react-router/dev` 7.12.0 - Development and build utilities
  - `@react-router/fs-routes` 7.12.0 - File-system based routing
  - `@react-router/node` 7.12.0 - Node.js server adapter
  - `@react-router/serve` 7.12.0 - Production server runner

**Shopify Integration:**
- `@shopify/app-bridge-react` 4.2.4 - Shopify Admin UI integration
- `@shopify/shopify-app-react-router` 1.1.0 - Shopify app authentication and middleware
- `@shopify/shopify-app-session-storage-prisma` 9.0.0 - Shopify session storage backed by Prisma

**Database:**
- Prisma 6.16.3 - ORM for SQLite and database migrations
  - `@prisma/client` 6.16.3 - Prisma client library

**Build/Dev:**
- Vite 6.3.6 - Frontend build tool and dev server
  - `vite-tsconfig-paths` 5.1.4 - TypeScript path alias resolution in Vite
- `react-router` CLI - Used for build scripts (see `package.json` scripts)

**Code Quality:**
- ESLint 8.57.1 - Linting with TypeScript and React support
  - `@typescript-eslint/parser` 6.21.0 - TypeScript AST parser
  - `@typescript-eslint/eslint-plugin` 6.21.0 - TypeScript-specific rules
  - `eslint-plugin-react` 7.37.5 - React linting rules
  - `eslint-plugin-react-hooks` 4.6.2 - React hooks linting
  - `eslint-plugin-jsx-a11y` 6.10.2 - Accessibility linting
  - `eslint-plugin-import` 2.32.0 - Import/export linting
  - `eslint-import-resolver-typescript` 3.10.1 - TypeScript import resolution

- Prettier 3.6.2 - Code formatter (no dedicated config file, uses defaults)

## Key Dependencies

**Critical:**
- React Router - Powers all routing and full-stack rendering
- Shopify App Bridge - Enables embedded admin UI integration
- Prisma - Manages database schema, migrations, and client access
- `@shopify/api-codegen-preset` 1.2.0 - Generates TypeScript types for Shopify Admin API

**Utilities:**
- `isbot` 5.1.31 - Bot detection for user agents
- React DOM 18.3.1 - React rendering engine

## Configuration

**Environment:**
- Configured via `process.env` variables (see `app/shopify.server.ts`)
  - `SHOPIFY_API_KEY` - Shopify app API key
  - `SHOPIFY_API_SECRET` - Shopify app API secret
  - `SHOPIFY_APP_URL` - Public URL for app callbacks
  - `SCOPES` - Comma-separated Shopify API scopes
  - `SHOP_CUSTOM_DOMAIN` - Optional custom shop domain
  - `NODE_ENV` - Environment (development/production)
  - `PORT` - Server port (default: 3000)
  - `FRONTEND_PORT` - Frontend HMR port (default: 8002)

**Build:**
- `vite.config.ts` - Vite configuration with React Router and TypeScript paths
- `tsconfig.json` - TypeScript compiler options (strict mode enabled, ES2022 target)
- `.eslintrc.cjs` - ESLint configuration with React and TypeScript rules
- `.graphqlrc.ts` - GraphQL code generation config for Shopify Admin API

**Shopify Configuration:**
- `shopify.app.toml` - App metadata, webhooks, scopes, metafield definitions
- `shopify.web.toml` - Web role configuration, predev and dev commands

## Platform Requirements

**Development:**
- Node.js 20.19 or higher
- npm or pnpm
- OpenSSL (bundled in Docker image)
- Shopify CLI (for `shopify app dev`, `shopify app deploy` commands)

**Production:**
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

---

*Stack analysis: 2026-07-13*
