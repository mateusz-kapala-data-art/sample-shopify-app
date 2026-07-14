// [SHOWCASE] shared App Bridge optional-scope query/request helper — extracted from
// the enableShippingModule pattern (Phase 3 MOD-01/02), reused by SHOW-04/07/08/10.
// query() -> request() -> re-query() -> return granted state. A decline is a state,
// not an error (MOD-02 precedent) — this helper never throws on decline.
import type { useAppBridge } from "@shopify/app-bridge-react";

export async function ensureScope(
  shopify: ReturnType<typeof useAppBridge>,
  scope: string,
): Promise<{ granted: boolean; grantedScopes: string[] }> {
  // App Bridge scopes API is not in the shared type surface here — access dynamically.
  const scopesApi = (
    shopify as unknown as {
      scopes: {
        query: () => Promise<{ granted: string[] }>;
        request: (
          s: string[],
        ) => Promise<{ result: string; detail?: { granted?: string[] } }>;
      };
    }
  ).scopes;

  const { granted } = await scopesApi.query();
  if (granted.includes(scope)) {
    return { granted: true, grantedScopes: granted };
  }

  const res = await scopesApi.request([scope]);
  if (res.result === "granted-all") {
    const after = await scopesApi.query();
    return { granted: true, grantedScopes: after.granted };
  }

  // MOD-02: a decline is a state, not an error — return it, never throw.
  return { granted: false, grantedScopes: granted };
}
