// [DEMO 5] [SLIDE D4] Per-store detail — a read-only drill-in from the registry: full
// registry fields, static module status (data connection is a hard-coded internal
// status per spec §5), on-demand re-sync (UI-02), and the recent webhook events that
// kept this row current (HOOK-02..06 in action). Not in the nav — reached by row click.
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { isDegraded } from "../lib/tokenService.server";
import { resyncStore } from "../lib/registrySync.server";
import { DeckAnchor, statusTone, cleanHost, formatSynced, splitScopes } from "../lib/presentation";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = decodeURIComponent(params.shop ?? "");
  const store = await db.store.findUnique({ where: { shopifyDomain: shop } });
  if (!store) {
    throw new Response("Store not found in registry", { status: 404 });
  }
  const events = await db.webhookEvent.findMany({
    where: { shop },
    orderBy: { receivedAt: "desc" },
    take: 10,
  });
  return {
    currentShop: session.shop,
    degraded: isDegraded(),
    store: {
      ...store,
      installedAt: store.installedAt.toISOString(),
      uninstalledAt: store.uninstalledAt ? store.uninstalledAt.toISOString() : null,
      lastSyncedAt: store.lastSyncedAt ? store.lastSyncedAt.toISOString() : null,
    },
    events: events.map((e) => ({
      id: e.id,
      topic: e.topic,
      receivedAt: e.receivedAt.toISOString(),
      processedAt: e.processedAt ? e.processedAt.toISOString() : null,
    })),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const shop = decodeURIComponent(params.shop ?? "");
  const form = await request.formData();
  const intent = String(form.get("intent"));

  // [DEMO SCOPE] Single-org platform app: any authenticated operator may re-sync any
  // registry row (the target shop is the route param). session.shop is NOT an
  // authorization boundary here — a multi-tenant deploy MUST gate on an operator role.
  if (intent === "resync") {
    const store = await db.store.findUnique({ where: { shopifyDomain: shop } });
    if (!store) return { ok: false, intent, error: "Store not found" };
    try {
      await resyncStore(shop);
      return { ok: true, intent };
    } catch (err) {
      if (err instanceof Response) throw err; // React Router control flow (re-auth)
      return { ok: false, intent, error: "Re-sync failed (may be in degraded mode)." };
    }
  }

  return { ok: false, intent: "unknown" };
};

// One label/value row in the details list.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <s-stack direction="block" gap="none">
      <s-text color="subdued">{label}</s-text>
      <s-text>{children}</s-text>
    </s-stack>
  );
}

export default function StoreDetail() {
  const { store, events, currentShop, degraded } = useLoaderData<typeof loader>();
  const resyncFetcher = useFetcher<typeof action>();
  const isCurrent = store.shopifyDomain === currentShop;
  const scopes = splitScopes(store.grantedScopes);

  return (
    <s-page heading={store.shopifyDomain}>
      <DeckAnchor>Registry · store detail · Demo 5 · deck section D</DeckAnchor>
      <s-button slot="primary-action" href="/app" variant="tertiary">
        ← Back to registry
      </s-button>

      {degraded && (
        <s-banner tone="critical" heading="Token service degraded">
          <s-paragraph>
            Background jobs are paused until credentials recover. Re-sync will fail while
            degraded.
          </s-paragraph>
        </s-banner>
      )}

      <s-section heading="Store details">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-badge tone={statusTone(store.status ?? "")}>{store.status}</s-badge>
            {isCurrent && <s-badge tone="info">You</s-badge>}
          </s-stack>
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <Field label="Plan">{store.plan ?? "—"}</Field>
            <Field label="Theme">
              {store.themeName ?? "—"}
              {store.themeVersion ? ` (v${store.themeVersion})` : ""}
            </Field>
            <Field label="Primary domain">
              {store.primaryDomain ? cleanHost(store.primaryDomain) : "—"}
            </Field>
            <Field label="Contact email">{store.contactEmail ?? "—"}</Field>
            <Field label="Installed">{formatSynced(store.installedAt)}</Field>
            <Field label="Last synced">{formatSynced(store.lastSyncedAt)}</Field>
            {store.uninstalledAt && (
              <Field label="Uninstalled">{formatSynced(store.uninstalledAt)}</Field>
            )}
          </s-grid>
        </s-stack>
      </s-section>

      <s-section heading="Granted scopes">
        {scopes.length === 0 ? (
          <s-text color="subdued">None</s-text>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {scopes.map((sc) => (
              <s-badge key={sc} tone={sc === "read_locales" ? "success" : "neutral"}>
                {sc}
              </s-badge>
            ))}
          </div>
        )}
      </s-section>

      <s-section heading="Modules">
        <s-stack direction="block" gap="base">
          {/* spec §5/§9: data connection is a hard-coded internal status, not live */}
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-badge tone={store.dataConnected ? "info" : "neutral"}>
              Data · internal {store.dataConnected ? "connected" : "off"}
            </s-badge>
            <s-badge tone={store.fansifterConnected ? "info" : "neutral"}>
              Fansifter · internal {store.fansifterConnected ? "connected" : "off"}
            </s-badge>
          </s-stack>
          <s-button
            variant="secondary"
            onClick={() => resyncFetcher.submit({ intent: "resync" }, { method: "post" })}
            {...(resyncFetcher.state !== "idle" ? { loading: true } : {})}
          >
            Run re-sync now
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading={`Recent webhook events (${events.length})`}>
        {events.length === 0 ? (
          <s-text color="subdued">No webhook events recorded for this store yet.</s-text>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Topic</s-table-header>
              <s-table-header>Received</s-table-header>
              <s-table-header>Applied</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {events.map((e) => (
                <s-table-row key={e.id}>
                  <s-table-cell>{e.topic}</s-table-cell>
                  <s-table-cell>
                    <s-text color="subdued">{formatSynced(e.receivedAt)}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={e.processedAt ? "success" : "neutral"}>
                      {e.processedAt ? "Applied" : "Pending"}
                    </s-badge>
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
