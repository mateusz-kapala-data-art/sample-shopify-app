// [DEMO 5] [SLIDE D4] Registry — the home route and the operator's live view of every
// registered store (UI-01). Rows self-register on install (REG-01) and update via
// shop/update (HOOK-04); nothing here is typed by hand. Read-only by design: the data
// connection is a hard-coded internal status (spec §5/§9), not a live integration.
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { isDegraded, setSimulatedDegraded, clearDegraded } from "../lib/tokenService.server";
import { resyncStore } from "../lib/registrySync.server";
import {
  DeckAnchor,
  statusTone,
  cleanHost,
  formatSyncedShort,
} from "../lib/presentation";

// [SLIDE D1] UI-04: the registry query — kept character-identical to the deck's Slide D1
// so the on-screen code matches the slide. This is the exact shape afterAuth/resync use
// (app/lib/registrySync.server.ts) to populate the Store rows the table below renders.
const REGISTRY_QUERY = `#graphql
  query registrySync {
    shop {
      id
      name
      contactEmail
      primaryDomain { url }
      plan { displayName }
    }
    themes(first: 1, roles: [MAIN]) {
      nodes { name }
    }
  }`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  // Run the Slide-D1 query live for the current shop (UI-04) — the table itself reads
  // the durable Store rows, but this keeps the exact slide query executing on stage.
  await admin.graphql(REGISTRY_QUERY);
  const stores = await db.store.findMany({ orderBy: { installedAt: "desc" } });
  return {
    currentShop: session.shop,
    degraded: isDegraded(), // UI-03 / SEC-04
    stores: stores.map((s) => ({
      shopifyDomain: s.shopifyDomain,
      primaryDomain: s.primaryDomain,
      status: s.status,
      plan: s.plan,
      themeName: s.themeName,
      themeVersion: s.themeVersion,
      dataConnected: s.dataConnected,
      fansifterConnected: s.fansifterConnected,
      lastSyncedAt: s.lastSyncedAt ? s.lastSyncedAt.toISOString() : null,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));

  // [DEMO SCOPE] Single-org platform app: every installed store belongs to Sony, so any
  // authenticated operator may act on any registry row. session.shop is NOT an
  // authorization boundary here — a multi-tenant deploy MUST gate on an operator role.

  if (intent === "resync") {
    // UI-02: re-sync uses the client-credentials token service, not the session token.
    const shop = String(form.get("shop") || session.shop);
    const store = await db.store.findUnique({ where: { shopifyDomain: shop } });
    if (!store) return { ok: false, intent, shop, error: "Store not found" };
    try {
      await resyncStore(shop);
      return { ok: true, intent, shop };
    } catch (err) {
      if (err instanceof Response) throw err; // React Router control flow (re-auth)
      return { ok: false, intent, shop, error: "Re-sync failed — check credentials (may be degraded)." };
    }
  }

  if (intent === "simulate-degraded") {
    setSimulatedDegraded(true); // [SLIDE C4] rehearsal breach branch (spec §5d)
    return { ok: true, intent };
  }
  if (intent === "recover-degraded") {
    clearDegraded();
    return { ok: true, intent };
  }

  return { ok: false, intent: "unknown" };
};

// Per-row re-sync — its own fetcher so rows submit independently (UI-02).
function ResyncButton({ shop }: { shop: string }) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="resync" />
      <input type="hidden" name="shop" value={shop} />
      <s-button type="submit" variant="secondary" {...(busy ? { loading: true } : {})}>
        Re-sync
      </s-button>
    </fetcher.Form>
  );
}

// [SLIDE C4] Rehearsal control — force/recover degraded mode without a real bad
// credential (spec §5d/§7), so the presenter can show the red banner + paused jobs.
function DegradedControl({ degraded }: { degraded: boolean }) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value={degraded ? "recover-degraded" : "simulate-degraded"} />
      <s-button type="submit" variant={degraded ? "primary" : "secondary"} {...(busy ? { loading: true } : {})}>
        {degraded ? "Recover from degraded mode" : "Simulate degraded mode"}
      </s-button>
    </fetcher.Form>
  );
}

export default function Registry() {
  const { stores, currentShop, degraded } = useLoaderData<typeof loader>();
  const activeCount = stores.filter((s) => s.status === "active").length;

  const Stat = ({ value, label }: { value: number; label: string }) => (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued" minInlineSize="120px">
      <s-stack direction="block" gap="none">
        <s-heading>{String(value)}</s-heading>
        <s-text color="subdued">{label}</s-text>
      </s-stack>
    </s-box>
  );

  return (
    <s-page heading="Registry" inlineSize="large">
      <DeckAnchor>Registry · Demo 5 · deck section D (slide D4)</DeckAnchor>

      {/* UI-03 / SEC-04: degraded-mode banner */}
      {degraded && (
        <s-banner tone="critical" heading="Token service degraded">
          <s-paragraph>
            An admin-token grant was rejected (invalid_client). Background jobs are paused
            until credentials recover. Check SHOPIFY_CLIENT_SECRETS.
          </s-paragraph>
        </s-banner>
      )}

      {/* [SLIDE C4] Rehearsal control — force/recover the breach branch on stage */}
      <s-section>
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text color="subdued">Rehearsal · breach branch (spec §5d):</s-text>
            <DegradedControl degraded={degraded} />
          </s-stack>
        </s-box>
      </s-section>

      {stores.length > 0 && (
        <s-section>
          <s-stack direction="inline" gap="base">
            <Stat value={stores.length} label="Registered" />
            <Stat value={activeCount} label="Active" />
          </s-stack>
        </s-section>
      )}

      <s-section heading="Registered stores">
        {stores.length === 0 ? (
          // Addendum A3: the empty state is itself a talking point (self-registration).
          <s-stack direction="block" gap="base" alignItems="center">
            <s-heading>No stores registered yet</s-heading>
            <s-paragraph>
              Stores self-register on install. Install the app on a development store — a
              row appears here automatically the moment the OAuth install completes.
            </s-paragraph>
          </s-stack>
        ) : (
          <s-stack direction="block" gap="base">
            <s-table variant="auto">
              <s-table-header-row>
                <s-table-header listSlot="primary">Store</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Plan</s-table-header>
                <s-table-header>Theme</s-table-header>
                <s-table-header>Data connection</s-table-header>
                <s-table-header>Synced</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {stores.map((s) => {
                  const isCurrent = s.shopifyDomain === currentShop;
                  return (
                    <s-table-row key={s.shopifyDomain}>
                      <s-table-cell>
                        <s-stack direction="block" gap="none">
                          <s-stack direction="inline" gap="base" alignItems="center">
                            <s-link href={`/app/registry/${encodeURIComponent(s.shopifyDomain)}`}>
                              {s.shopifyDomain}
                            </s-link>
                            {isCurrent && <s-badge tone="info">You</s-badge>}
                          </s-stack>
                          {s.primaryDomain && cleanHost(s.primaryDomain) !== s.shopifyDomain && (
                            <s-text color="subdued">{cleanHost(s.primaryDomain)}</s-text>
                          )}
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge tone={statusTone(s.status)}>{s.status}</s-badge>
                      </s-table-cell>
                      <s-table-cell>{s.plan ?? "—"}</s-table-cell>
                      <s-table-cell>
                        {s.themeName ? (
                          <s-stack direction="block" gap="none">
                            <s-text>{s.themeName}</s-text>
                            {s.themeVersion && <s-text color="subdued">v{s.themeVersion}</s-text>}
                          </s-stack>
                        ) : (
                          <s-text color="subdued">—</s-text>
                        )}
                      </s-table-cell>
                      <s-table-cell>
                        {/* spec §5/§9: hard-coded internal status, not a live integration */}
                        <s-badge tone={s.dataConnected ? "info" : "neutral"}>
                          {s.dataConnected ? "internal · connected" : "internal · off"}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text color="subdued">{formatSyncedShort(s.lastSyncedAt)}</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <ResyncButton shop={s.shopifyDomain} />
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
            <s-text color="subdued">
              Rows are written by the install handler and updated by shop/update — nothing
              here is entered by hand.
            </s-text>
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
