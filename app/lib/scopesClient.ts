// [SHOWCASE] shared App Bridge optional-scope query/request helper — extracted from
// the enableShippingModule pattern (Phase 3 MOD-01/02), reused by SHOW-04/07/08/10.
// query() -> request() -> re-query() -> return granted state. A decline is a state,
// not an error (MOD-02 precedent) — this helper never throws on decline.
import type { useAppBridge } from "@shopify/app-bridge-react";

export async function ensureScope(
  shopify: ReturnType<typeof useAppBridge>,
  scope: string,
): Promise<{ granted: boolean; grantedScopes: string[]; error?: string }> {
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

  // A DECLINE is a state (returned below); a THROW is not. query()/request() reject when
  // App Bridge isn't ready or the iframe/network fails. Every caller is an async onClick
  // with no .catch, so an un-caught rejection here = a button that silently does nothing
  // (same class as CR-01, reached from the client). Convert it to a distinguishable state
  // so the console can tell "declined" from "App Bridge broke" — different stories on stage.
  try {
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
  } catch (err) {
    return {
      granted: false,
      grantedScopes: [],
      error: (err as Error).message ?? "Scope request failed",
    };
  }
}
