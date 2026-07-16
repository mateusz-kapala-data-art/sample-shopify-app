// [DEMO 6] [SLIDES I2/I3] Permissions — the live grant surface. The loader reads the
// scopes the app actually holds (currentAppInstallation.accessScopes), and the
// optional-scope card requests read_locales at runtime via App Bridge (spec §3),
// granted without re-approving the whole app. A decline is a state, not an error.
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureScope } from "../lib/scopesClient";
import { DeckAnchor } from "../lib/presentation";

// Slide I2: the exact granted-scopes query, schema-checked against admin 2026-07.
const GRANTED_SCOPES_QUERY = `#graphql
  query grantedScopes {
    currentAppInstallation {
      accessScopes {
        handle
      }
    }
  }`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const res = await admin.graphql(GRANTED_SCOPES_QUERY);
  const body: any = await res.json();
  const granted: string[] = (
    body?.data?.currentAppInstallation?.accessScopes ?? []
  ).map((s: any) => s.handle);
  return { granted };
};

export default function Permissions() {
  const { granted } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  // read_locales can flip to granted after a successful runtime request (spec §3).
  const [localesGranted, setLocalesGranted] = useState(
    granted.includes("read_locales"),
  );
  // A decline is a state (warning banner); an App Bridge/network failure is an
  // error (critical banner) — the two tell different stories on stage.
  const [declined, setDeclined] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const requestLocales = async () => {
    setDeclined(false);
    setScopeError(null);
    const { granted: ok, error } = await ensureScope(shopify, "read_locales");
    if (error) {
      setScopeError(error);
    } else if (ok) {
      shopify.toast.show("read_locales granted");
      setLocalesGranted(true);
    } else {
      setDeclined(true);
    }
  };

  return (
    <s-page heading="Permissions">
      <DeckAnchor>Permissions · Demo 6 · deck section I (slides I2/I3)</DeckAnchor>

      {/* App Bridge / network failure — distinct from a decline (spec §3). */}
      {scopeError && (
        <s-banner tone="critical" heading="Permission request failed">
          <s-paragraph>
            Couldn&apos;t reach the App Bridge scopes API ({scopeError}). This is a
            connection problem, not a decline — try again.
          </s-paragraph>
        </s-banner>
      )}

      {/* A decline is a state, not an error — the app keeps working. */}
      {declined && (
        <s-banner tone="warning" heading="Scope not granted">
          <s-paragraph>
            read_locales was declined. That&apos;s fine — the app keeps working, and
            you can request it again later.
          </s-paragraph>
        </s-banner>
      )}

      <s-section heading="Granted scopes">
        {granted.length === 0 ? (
          <s-text color="subdued">None</s-text>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {granted.map((handle) => (
              <s-badge key={handle} tone="success">
                {handle}
              </s-badge>
            ))}
          </div>
        )}
      </s-section>

      <s-section heading="Optional scope">
        <s-stack direction="block" gap="base">
          {localesGranted ? (
            <s-badge tone="success">read_locales · granted</s-badge>
          ) : (
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-badge tone="neutral">read_locales · not granted</s-badge>
              <s-button variant="primary" onClick={requestLocales}>
                Request read_locales access
              </s-button>
            </s-stack>
          )}
          <s-text color="subdued">
            This is the runtime optional-scope request — spec §3&apos;s read_locales,
            granted without re-approving the app.
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="App-level grants">
        {/* Static, mirrors slide I2 — the grants this demo intentionally does not use. */}
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-stack direction="block" gap="none">
            <s-text color="subdued">Protected customer data</s-text>
            <s-badge tone="neutral">
              not requested — out of scope for this demo
            </s-badge>
          </s-stack>
          <s-stack direction="block" gap="none">
            <s-text color="subdued">Restricted scopes</s-text>
            <s-badge tone="neutral">none</s-badge>
          </s-stack>
        </s-grid>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
