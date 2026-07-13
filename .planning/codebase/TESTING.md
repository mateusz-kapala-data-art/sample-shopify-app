# Testing Patterns

**Analysis Date:** 2026-07-13

## Test Framework

**Runner:**
- **Status:** Not configured
- **Recommended:** Vitest or Jest
- **Note:** No test configuration files detected (`vitest.config.ts`, `jest.config.js`, etc.)

**Assertion Library:**
- **Status:** Not installed
- **Recommended:** Vitest (includes Vitest assertions) or Jest (includes Jest matchers)

**Run Commands:**
```bash
npm test                 # Would run tests (not configured yet)
npm test -- --watch     # Watch mode (not configured yet)
npm test -- --coverage  # Coverage report (not configured yet)
```

**Current Status:**
- No test framework installed
- No test dependencies in `package.json` (no vitest, jest, @testing-library/* packages)
- No test files exist in the codebase (`app/**/*.test.ts`, `app/**/*.spec.ts`)
- Testing infrastructure needs to be established

## Test File Organization

**Location:**
- **Recommended pattern:** Co-located with source files
- **Convention to establish:** Place test files next to source files
  - Example: `app/db.server.ts` → `app/db.server.test.ts`
  - Example: `app/routes/app._index.tsx` → `app/routes/app._index.test.tsx`
  - Alternative: Separate `__tests__` directory for large test suites

**Naming:**
- **Recommended:** `{filename}.test.ts` or `{filename}.spec.ts`
- **Not used yet:** `.spec.ts` suffix (common in Angular/Jasmine)
- **Suggested:** Use `.test.ts` to match common TypeScript project conventions

**Structure:**
```
app/
├── db.server.ts
├── db.server.test.ts          # Unit test for Prisma client
├── shopify.server.ts
├── shopify.server.test.ts      # Unit test for Shopify initialization
├── entry.server.tsx
├── entry.server.test.tsx       # Server rendering tests
├── routes/
│   ├── app._index.tsx
│   ├── app._index.test.tsx     # Loader, action, component tests
```

## Test Structure

**Suite Organization:**
```typescript
// Recommended structure for test files in this project
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// File: app/db.server.test.ts
describe('Prisma Database Client', () => {
  beforeEach(() => {
    // Reset Prisma singleton before each test
  });

  describe('initialization', () => {
    it('creates a single Prisma instance in development', () => {
      // Test that singleton pattern works correctly
    });
  });
});

// File: app/routes/app._index.test.tsx
describe('Index Route', () => {
  describe('loader', () => {
    it('requires admin authentication', async () => {
      // Test that loader calls authenticate.admin
    });

    it('returns null when authenticated', async () => {
      // Test return value
    });
  });

  describe('action', () => {
    it('creates a product via GraphQL', async () => {
      // Test product creation
    });

    it('returns product, variant, and metaobject data', async () => {
      // Test action return shape
    });
  });

  describe('Index component', () => {
    it('renders the product generation button', () => {
      // Test component rendering
    });
  });
});
```

**Patterns:**
- **Setup pattern:** `beforeEach` for resetting state, mocking, and test fixtures
- **Teardown pattern:** `afterEach` for cleanup, restoring original implementations
- **Assertion pattern:** `expect()` assertions with descriptive messages

## Mocking

**Framework:** 
- **To be determined:** Vitest's `vi` module or Jest's `jest` object
- **Recommended:** Vitest for TypeScript-first projects (better type support)

**Patterns:**
```typescript
// Recommended mocking for React Router handlers
import { vi } from 'vitest';

describe('app.tsx loader', () => {
  it('authenticates the request', async () => {
    const mockRequest = new Request('http://localhost/app', {
      headers: new Headers({ 'Cookie': 'session=abc123' }),
    });
    
    const result = await loader({ request: mockRequest });
    
    expect(result.apiKey).toBeDefined();
  });
});

// For Prisma (database)
import { PrismaClient } from '@prisma/client';

describe('Database operations', () => {
  let prismaMock: PrismaClient;

  beforeEach(() => {
    prismaMock = {
      // Mock Prisma methods
    } as unknown as PrismaClient;
  });
});

// For Shopify API client
import shopify from '~/shopify.server';

describe('Shopify integration', () => {
  beforeEach(() => {
    vi.spyOn(shopify, 'authenticate').mockResolvedValue({
      admin: {
        graphql: vi.fn().mockResolvedValue({
          json: async () => ({ data: { productCreate: { product: {} } } }),
        }),
      },
    });
  });
});
```

**What to Mock:**
- **External APIs:** Shopify Admin GraphQL API
  - Reason: Avoid actual API calls during testing
  - Method: Mock `admin.graphql()` to return test data
- **Database:** Prisma queries
  - Reason: Tests should be isolated and fast
  - Method: Use `vi.mock('@prisma/client')` or inject a mock instance
- **Authentication:** `authenticate.admin()` and `authenticate.unauthenticated()`
  - Reason: Control test scenarios (authenticated, unauthenticated, errors)
- **Environment variables:** Mock via `process.env` or test configuration
  - Reason: Ensure tests run in isolation from deployment configs

**What NOT to Mock:**
- **React components:** Test actual React Router component rendering
  - Exception: Web components (Shopify Polaris `<s-*>`) may need mocks if unavailable in test environment
- **TypeScript types:** Types are compile-time only; no mocking needed
- **React hooks:** Use real hooks; mock their dependencies instead
  - Example: Mock `useFetcher().submit()` indirectly by mocking form actions
- **Error boundaries:** Test with actual error boundaries to verify error UI

## Fixtures and Factories

**Test Data:**
```typescript
// Recommended fixture pattern for this project
// File: app/routes/__tests__/fixtures.ts

export const mockProduct = {
  id: 'gid://shopify/Product/123',
  title: 'Test Product',
  handle: 'test-product',
  status: 'ACTIVE',
  variants: {
    edges: [
      {
        node: {
          id: 'gid://shopify/ProductVariant/456',
          price: '100.00',
          barcode: 'ABC123',
          createdAt: '2024-01-01T00:00:00Z',
        },
      },
    ],
  },
};

export const mockGraphQLResponse = (data: any) => ({
  json: async () => ({ data }),
});

// Factory for creating test request objects
export const createMockRequest = (overrides = {}) => {
  return new Request('http://localhost/app', {
    headers: new Headers({
      'Cookie': 'session=abc123',
      'Content-Type': 'application/json',
    }),
    ...overrides,
  });
};
```

**Location:**
- Recommended: `app/routes/__tests__/fixtures.ts` or `app/__tests__/fixtures.ts`
- Alternative: Co-locate with test file if small (< 50 lines)
- Pattern: Export reusable objects and factory functions

## Coverage

**Requirements:** 
- Not enforced (no coverage configuration detected)
- Recommended target: 70%+ for critical paths (authentication, API calls, mutations)

**View Coverage:**
```bash
npm test -- --coverage              # Generate coverage report
npm test -- --coverage --ui         # View coverage in web UI (Vitest)
```

**Files to prioritize testing:**
1. `app/shopify.server.ts` — Shopify SDK initialization (critical for all auth)
2. `app/db.server.ts` — Database connection (critical for persistence)
3. `app/routes/app.tsx` — Main app layout and auth boundary
4. `app/routes/app._index.tsx` — Product creation (core app functionality)
5. Webhook handlers (`webhooks.app.*.tsx`) — Ensure data consistency

## Test Types

**Unit Tests:**
- **Scope:** Test individual functions, handlers, components in isolation
- **Approach:** Mock external dependencies (APIs, database, auth)
- **Examples:**
  - `loader` function returns correct API key
  - `action` function makes correct GraphQL mutation
  - Component renders correct UI given props
- **Framework:** Vitest with `describe`, `it`, `expect`

**Integration Tests:**
- **Scope:** Test interactions between components, handlers, and mocked external services
- **Approach:** Use real React Router loaders/actions, mock only external APIs and database
- **Examples:**
  - Full product creation flow (loader → action → GraphQL API mock)
  - Authentication flow (login route → action → session storage mock)
  - Component receives data from loader via `useLoaderData()`
- **Framework:** Vitest with React Router testing utilities (when available)

**E2E Tests:**
- **Status:** Not currently implemented
- **Framework:** Playwright or Cypress recommended for Shopify apps
- **When to add:** After core features are stable and critical user flows need verification
- **Examples:**
  - Full authentication flow in real Shopify environment
  - Product creation from UI to Shopify admin
  - Webhook handling end-to-end

## Common Patterns

**Async Testing:**
```typescript
// Testing async loaders and actions
describe('loader', () => {
  it('handles async authentication', async () => {
    const request = createMockRequest();
    
    const result = await loader({ request });
    
    expect(result).toBeDefined();
  });

  it('throws on authentication failure', async () => {
    const request = createMockRequest();
    vi.spyOn(shopify.authenticate, 'admin').mockRejectedValue(
      new Error('Unauthorized')
    );
    
    await expect(loader({ request })).rejects.toThrow('Unauthorized');
  });
});
```

**Error Testing:**
```typescript
// Testing error boundaries and error handling
describe('error scenarios', () => {
  it('error boundary catches loader errors', () => {
    // Test that ErrorBoundary renders when loader throws
    vi.spyOn(shopify.authenticate, 'admin').mockRejectedValue(
      new Error('Auth failed')
    );
    
    // Verify boundary.error is called
    expect(ErrorBoundary).toBeDefined();
  });

  it('action handles GraphQL errors', async () => {
    vi.spyOn(admin, 'graphql').mockResolvedValue({
      json: async () => ({
        data: null,
        errors: [{ message: 'Product already exists' }],
      }),
    });
    
    // Test handling of error response
  });
});

// Testing non-null assertions and type safety
describe('type safety', () => {
  it('accesses nested properties safely', async () => {
    const response = mockGraphQLResponse({
      productCreate: { product: { id: '123' } },
    });
    
    // In actual code: responseJson!.data!.productCreate!.product!
    // In tests: verify the assertion is safe with known data
    const json = await response.json();
    expect(json.data?.productCreate?.product?.id).toBe('123');
  });
});
```

**Testing React components with hooks:**
```typescript
// Testing components that use useFetcher, useLoaderData
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Index component', () => {
  it('renders product generation button', () => {
    // Will need React Router test utilities
    // const { container } = render(<Index />, { /* router setup */ });
    // const button = screen.getByRole('button', { name: /generate/i });
    // expect(button).toBeInTheDocument();
  });

  it('calls fetcher.submit on button click', async () => {
    // Mock useFetcher hook
    // Verify submit was called with correct arguments
  });
});
```

---

*Testing analysis: 2026-07-13*

**NEXT STEPS:**
1. Install test framework: `npm install --save-dev vitest @vitest/ui`
2. Install testing utilities: `npm install --save-dev @testing-library/react @testing-library/user-event`
3. Create `vitest.config.ts` with React Router configuration
4. Write unit tests for critical modules (`db.server.ts`, `shopify.server.ts`)
5. Add pre-commit hook to run tests before commits
