// [DEMO 5] [SLIDE D3] Per-store detail — drill into one registered store: full
// registry fields, module toggles (shipping via runtime scope; Data/Fansifter as
// platform flags), on-demand re-sync (UI-02), and the recent webhook events that
// kept this row current (HOOK-02..06 in action).
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
import { ensureScope } from "../lib/scopesClient";

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
      netsuiteLastPush: store.netsuiteLastPush
        ? store.netsuiteLastPush.toISOString()
        : null,
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
  const { session } = await authenticate.admin(request);
  const shop = decodeURIComponent(params.shop ?? "");
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "resync") {
    try {
      await resyncStore(shop);
      return { ok: true, intent };
    } catch (err) {
      // A thrown Response is React Router control flow (re-auth), not a failure.
      if (err instanceof Response) throw err;
      return { ok: false, intent, error: "Re-sync failed (may be in degraded mode)." };
    }
  }

  if (intent === "toggle-connector") {
    const connector = String(form.get("connector"));
    const store = await db.store.findUnique({ where: { shopifyDomain: shop } });
    if (!store) return { ok: false, intent, error: "Store not found" };
    const field = connector === "fansifter" ? "fansifterConnected" : "dataConnected";
    await db.store.update({
      where: { shopifyDomain: shop },
      data: { [field]: !store[field] },
    });
    return { ok: true, intent, connector };
  }

  if (intent === "enable-module") {
    // updateMany, not update: update() throws Prisma P2025 if the registry row is
    // missing, surfacing a raw error banner instead of an honest "not in registry".
    const granted = String(form.get("granted") || "");
    const updated = await db.store.updateMany({
      where: { shopifyDomain: session.shop },
      data: { shippingModule: true, grantedScopes: granted },
    });
    if (updated.count === 0) {
      return { ok: false, intent, error: "Store not in registry — nothing to update." };
    }
    return { ok: true, intent };
  }

  if (intent === "enable-theme-module") {
    // SHOW-10: same grant-then-persist shape as enable-module, gated on write_themes.
    const granted = String(form.get("granted") || "");
    const updated = await db.store.updateMany({
      where: { shopifyDomain: session.shop },
      data: { themeModule: true, grantedScopes: granted },
    });
    if (updated.count === 0) {
      return { ok: false, intent, error: "Store not in registry — nothing to update." };
    }
    return { ok: true, intent };
  }

  return { ok: false, intent: "unknown" };
};

function statusTone(status: string): "success" | "critical" | "neutral" {
  if (status === "active") return "success";
  if (status === "uninstalled") return "critical";
  return "neutral";
}

function cleanHost(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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
  const shopify = useAppBridge();
  const resyncFetcher = useFetcher<typeof action>();
  const dataFetcher = useFetcher<typeof action>();
  const fansifterFetcher = useFetcher<typeof action>();
  const moduleFetcher = useFetcher<typeof action>();
  const [moduleDeclined, setModuleDeclined] = useState(false);
  const themeModuleFetcher = useFetcher<typeof action>();
  const [themeModuleDeclined, setThemeModuleDeclined] = useState(false);
  // Distinct from a decline: an App Bridge / network failure must not leave the
  // button silently doing nothing (WR-07).
  const [scopeError, setScopeError] = useState<string | null>(null);

  const isCurrent = store.shopifyDomain === currentShop;
  const scopes = store.grantedScopes
    ? store.grantedScopes.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const enableShippingModule = async () => {
    setModuleDeclined(false);
    setScopeError(null);
    const { granted, grantedScopes, error } = await ensureScope(
      shopify,
      "write_shipping",
    );
    if (error) {
      setScopeError(error);
    } else if (granted) {
      moduleFetcher.submit(
        { intent: "enable-module", granted: grantedScopes.join(",") },
        { method: "post" },
      );
      shopify.toast.show("Shipping module enabled");
    } else {
      setModuleDeclined(true);
    }
  };

  // SHOW-10: same shape as enableShippingModule, gated on write_themes.
  const enableThemeModule = async () => {
    setThemeModuleDeclined(false);
    setScopeError(null);
    const { granted, grantedScopes, error } = await ensureScope(
      shopify,
      "write_themes",
    );
    if (error) {
      setScopeError(error);
    } else if (granted) {
      themeModuleFetcher.submit(
        { intent: "enable-theme-module", granted: grantedScopes.join(",") },
        { method: "post" },
      );
      shopify.toast.show("Theme module enabled");
    } else {
      setThemeModuleDeclined(true);
    }
  };

  const toggle = (fetcher: typeof dataFetcher, connector: "data" | "fansifter") =>
    fetcher.submit({ intent: "toggle-connector", connector }, { method: "post" });

  return (
    <s-page heading={store.shopifyDomain}>
      <s-button slot="primary-action" href="/app/registry" variant="tertiary">
        ← Back to registry
      </s-button>

      {degraded && (
        <s-banner tone="critical" heading="Token service degraded">
          <s-paragraph>
            Background jobs are paused until credentials recover. Re-sync will fail
            while degraded.
          </s-paragraph>
        </s-banner>
      )}

      {moduleDeclined && (
        <s-banner tone="warning" heading="Module unavailable">
          <s-paragraph>
            The write_shipping scope was declined — the shipping module stays off and
            the app keeps working.
          </s-paragraph>
        </s-banner>
      )}

      {themeModuleDeclined && (
        <s-banner tone="warning" heading="Module unavailable">
          <s-paragraph>
            The write_themes scope was declined — the theme module stays off and the
            app keeps working.
          </s-paragraph>
        </s-banner>
      )}

      {/* WR-07: App Bridge / network failure — distinct from a decline */}
      {scopeError && (
        <s-banner tone="critical" heading="Permission request failed">
          <s-paragraph>
            Couldn&apos;t reach the App Bridge scopes API ({scopeError}). This is a
            connection problem, not a decline — try again.
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
            <Field label="Installed">{fmt(store.installedAt)}</Field>
            <Field label="Last synced">{fmt(store.lastSyncedAt)}</Field>
            <Field label="NetSuite last push">{fmt(store.netsuiteLastPush)}</Field>
            {store.uninstalledAt && (
              <Field label="Uninstalled">{fmt(store.uninstalledAt)}</Field>
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
              <s-badge key={sc} tone={sc === "write_shipping" ? "success" : "neutral"}>
                {sc}
              </s-badge>
            ))}
          </div>
        )}
      </s-section>

      <s-section heading="Modules & actions">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-badge tone={store.shippingModule ? "success" : "neutral"}>
              Shipping {store.shippingModule ? "on" : "off"}
            </s-badge>
            <s-badge tone={store.dataConnected ? "success" : "neutral"}>
              Data {store.dataConnected ? "on" : "off"}
            </s-badge>
            <s-badge tone={store.fansifterConnected ? "success" : "neutral"}>
              Fansifter {store.fansifterConnected ? "on" : "off"}
            </s-badge>
            <s-badge tone={store.themeModule ? "success" : "neutral"}>
              Theme {store.themeModule ? "on" : "off"}
            </s-badge>
          </s-stack>

          <s-stack direction="inline" gap="base">
            <s-button
              variant="secondary"
              onClick={() => resyncFetcher.submit({ intent: "resync" }, { method: "post" })}
              {...(resyncFetcher.state !== "idle" ? { loading: true } : {})}
            >
              Run re-sync now
            </s-button>
            <s-button
              variant="tertiary"
              onClick={() => toggle(dataFetcher, "data")}
              {...(dataFetcher.state !== "idle" ? { loading: true } : {})}
            >
              {store.dataConnected ? "Disconnect Data" : "Connect Data"}
            </s-button>
            <s-button
              variant="tertiary"
              onClick={() => toggle(fansifterFetcher, "fansifter")}
              {...(fansifterFetcher.state !== "idle" ? { loading: true } : {})}
            >
              {store.fansifterConnected ? "Disconnect Fansifter" : "Connect Fansifter"}
            </s-button>
            {isCurrent && !store.shippingModule && (
              <s-button variant="primary" onClick={enableShippingModule}>
                Enable shipping module
              </s-button>
            )}
            {isCurrent && !store.themeModule && (
              <s-button variant="primary" onClick={enableThemeModule}>
                Enable theme module
              </s-button>
            )}
          </s-stack>
          {!isCurrent && (
            <s-text color="subdued">
              Shipping and theme modules need runtime-granted scopes, which can only
              be requested while viewing this store as the logged-in shop.
            </s-text>
          )}
        </s-stack>
      </s-section>

      <s-section heading={`Recent webhook events (${events.length})`}>
        {events.length === 0 ? (
          <s-text color="subdued">
            No webhook events recorded for this store yet.
          </s-text>
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
                    <s-text color="subdued">{fmt(e.receivedAt)}</s-text>
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
