// [DEMO 5] [SLIDE D3] Registry page — the operator's live view of every registered store
// (UI-01), on-demand re-sync via the client-credentials token service (UI-02), a
// degraded-mode banner driven by the Phase 2 SEC-04 flag (UI-03), and a runtime
// write_shipping optional-scope request for the shipping module (MOD-01/02).
import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { isDegraded } from "../lib/tokenService.server";
import { resyncStore } from "../lib/registrySync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const stores = await db.store.findMany({ orderBy: { installedAt: "desc" } });
  return {
    currentShop: session.shop,
    degraded: isDegraded(), // UI-03 / SEC-04
    stores: stores.map((s) => ({
      shopifyDomain: s.shopifyDomain,
      primaryDomain: s.primaryDomain,
      status: s.status,
      plan: s.plan,
      themeVersion: s.themeVersion,
      grantedScopes: s.grantedScopes,
      shippingModule: s.shippingModule,
      lastSyncedAt: s.lastSyncedAt ? s.lastSyncedAt.toISOString() : null,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "resync") {
    // UI-02: re-sync uses the client-credentials token service, not the session token.
    const shop = String(form.get("shop") || session.shop);
    try {
      await resyncStore(shop);
      return { ok: true, intent, shop };
    } catch {
      // getAdminToken may have tripped SEC-04 degraded mode on invalid_client.
      return { ok: false, intent, shop, error: "Re-sync failed — check credentials (may be in degraded mode)." };
    }
  }

  if (intent === "enable-module") {
    // MOD-02: the client already completed the App Bridge grant; persist the result
    // for the CURRENT shop. Declines never reach here (handled client-side).
    const granted = String(form.get("granted") || "");
    await db.store.update({
      where: { shopifyDomain: session.shop },
      data: { shippingModule: true, grantedScopes: granted },
    });
    return { ok: true, intent };
  }

  return { ok: false, intent: "unknown" };
};

function statusTone(status: string): "success" | "critical" | "neutral" {
  if (status === "active") return "success";
  if (status === "uninstalled") return "critical";
  return "neutral";
}

// Per-row re-sync button — its own fetcher so rows submit independently (UI-02).
function ResyncButton({ shop }: { shop: string }) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="resync" />
      <input type="hidden" name="shop" value={shop} />
      <s-button type="submit" variant="secondary" {...(busy ? { loading: true } : {})}>
        Run re-sync now
      </s-button>
    </fetcher.Form>
  );
}

export default function Registry() {
  const { stores, currentShop, degraded } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const moduleFetcher = useFetcher<typeof action>();
  const [moduleDeclined, setModuleDeclined] = useState(false);

  // MOD-01/02: request write_shipping at runtime via the App Bridge Scopes API.
  const enableShippingModule = async () => {
    setModuleDeclined(false);
    // App Bridge scopes API is not in the shared type surface here — access dynamically.
    const scopesApi = (shopify as unknown as {
      scopes: {
        query: () => Promise<{ granted: string[] }>;
        request: (s: string[]) => Promise<{ result: string; detail?: { granted?: string[] } }>;
      };
    }).scopes;

    const { granted } = await scopesApi.query();
    if (granted.includes("write_shipping")) {
      // Already granted — just record it.
      moduleFetcher.submit(
        { intent: "enable-module", granted: granted.join(",") },
        { method: "post" },
      );
      shopify.toast.show("Shipping module enabled");
      return;
    }

    const res = await scopesApi.request(["write_shipping"]);
    if (res.result === "granted-all") {
      const after = await scopesApi.query();
      moduleFetcher.submit(
        { intent: "enable-module", granted: after.granted.join(",") },
        { method: "post" },
      );
      shopify.toast.show("Shipping module enabled");
    } else {
      // MOD-02: a decline is a state, not an error — show a banner and carry on.
      setModuleDeclined(true);
    }
  };

  const currentRow = stores.find((s) => s.shopifyDomain === currentShop);
  const moduleOn = currentRow?.shippingModule ?? false;

  return (
    <s-page heading="Store registry">
      <s-button
        slot="primary-action"
        onClick={enableShippingModule}
        {...(moduleOn ? { disabled: true } : {})}
      >
        {moduleOn ? "Shipping module enabled" : "Enable shipping module"}
      </s-button>

      {/* UI-03 / SEC-04: degraded-mode banner */}
      {degraded && (
        <s-banner tone="critical" heading="Token service degraded">
          <s-paragraph>
            An admin-token grant was rejected (invalid_client). Background jobs are
            paused until credentials recover. Check SHOPIFY_CLIENT_SECRETS.
          </s-paragraph>
        </s-banner>
      )}

      {/* MOD-02: decline is a state, not an error */}
      {moduleDeclined && (
        <s-banner tone="warning" heading="Module unavailable">
          <s-paragraph>
            The shipping module needs the write_shipping scope, which was declined.
            You can keep using the rest of the app and enable it later.
          </s-paragraph>
        </s-banner>
      )}

      <s-section heading={`Registered stores (${stores.length})`}>
        {stores.length === 0 ? (
          <s-paragraph>
            No stores registered yet. Install the app on a dev store to see a row
            appear here.
          </s-paragraph>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Store</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Plan</s-table-header>
              <s-table-header>Theme ver.</s-table-header>
              <s-table-header>Granted scopes</s-table-header>
              <s-table-header>Module</s-table-header>
              <s-table-header>Last synced</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {stores.map((s) => (
                <s-table-row key={s.shopifyDomain}>
                  <s-table-cell>
                    <s-stack direction="block" gap="none">
                      <s-text type="strong">{s.shopifyDomain}</s-text>
                      {s.primaryDomain && <s-text color="subdued">{s.primaryDomain}</s-text>}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={statusTone(s.status)}>{s.status}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{s.plan ?? "—"}</s-table-cell>
                  <s-table-cell>{s.themeVersion ?? "—"}</s-table-cell>
                  <s-table-cell>{s.grantedScopes || "—"}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={s.shippingModule ? "success" : "neutral"}>
                      {s.shippingModule ? "On" : "Off"}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString() : "—"}
                  </s-table-cell>
                  <s-table-cell>
                    <ResyncButton shop={s.shopifyDomain} />
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
