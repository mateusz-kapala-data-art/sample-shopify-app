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
import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { isDegraded } from "../lib/tokenService.server";
import { resyncStore } from "../lib/registrySync.server";
import {
  addShippingMethod,
  deleteShippingMethod,
  listShippingMethods,
  type ConditionOperator,
} from "../lib/shippingModule.server";
import { ensureScope } from "../lib/scopesClient";
import { DeckAnchor, statusTone, cleanHost, formatSynced, splitScopes } from "../lib/presentation";
import { useAutoRevalidate } from "../lib/useAutoRevalidate";

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
  // [DEMO 5] Only load shipping methods once the module is enabled — an unopened
  // module has nothing to show.
  const shippingMethods = store.shippingModule ? await listShippingMethods(shop) : [];
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
    shippingMethods: shippingMethods.map((m) => ({
      id: m.id,
      name: m.name,
      priceAmount: m.priceAmount.toString(),
      currencyCode: m.currencyCode,
      conditionOperator: m.conditionOperator,
      conditionAmount: m.conditionAmount ? m.conditionAmount.toString() : null,
    })),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
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

  // [DEMO 5] Client already ran ensureScope(shopify, "write_shipping") and confirmed
  // the grant — this branch just persists the resulting state.
  if (intent === "enable-shipping") {
    await db.store.update({ where: { shopifyDomain: shop }, data: { shippingModule: true } });
    return { ok: true, intent };
  }

  // [DEMO 5] Add a checkout shipping method via deliveryProfileUpdate.
  if (intent === "add-shipping-method") {
    const name = String(form.get("name") ?? "").trim();
    const priceAmount = String(form.get("priceAmount") ?? "");
    const conditionOperatorRaw = String(form.get("conditionOperator") ?? "");
    const conditionAmount = String(form.get("conditionAmount") ?? "");

    if (!name) return { ok: false, intent, error: "Name is required." };
    const priceNumber = Number(priceAmount);
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      return { ok: false, intent, error: "Price must be a positive number." };
    }
    const conditionOperator =
      conditionOperatorRaw === "AT_LEAST" || conditionOperatorRaw === "AT_MOST"
        ? (conditionOperatorRaw as ConditionOperator)
        : undefined;
    if (conditionOperator) {
      const conditionNumber = Number(conditionAmount);
      if (!Number.isFinite(conditionNumber) || conditionNumber < 0) {
        return { ok: false, intent, error: "Condition amount must be a non-negative number." };
      }
    }

    try {
      const result = await addShippingMethod(admin, shop, {
        name,
        priceAmount,
        conditionOperator,
        conditionAmount: conditionOperator ? conditionAmount : undefined,
      });
      if (!result.ok) return { ok: false, intent, error: result.error };
      return { ok: true, intent };
    } catch (err) {
      if (err instanceof Response) throw err;
      return { ok: false, intent, error: "Adding the shipping method failed." };
    }
  }

  // [DEMO 5] Retract a checkout shipping method.
  if (intent === "delete-shipping-method") {
    const methodId = String(form.get("methodId") ?? "");
    try {
      const result = await deleteShippingMethod(admin, shop, methodId);
      if (!result.ok) return { ok: false, intent, error: result.error };
      return { ok: true, intent };
    } catch (err) {
      if (err instanceof Response) throw err;
      return { ok: false, intent, error: "Deleting the shipping method failed." };
    }
  }

  return { ok: false, intent: "unknown" };
};

// [DEMO 5] Runtime write_shipping scope request — mirrors app.permissions.tsx's
// read_locales pattern. A decline is a state (shown inline), not an error.
function EnableShippingButton() {
  const shopify = useAppBridge();
  const enableFetcher = useFetcher();
  const [declined, setDeclined] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const busy = enableFetcher.state !== "idle";

  const onClick = async () => {
    setDeclined(false);
    setScopeError(null);
    const { granted, error } = await ensureScope(shopify, "write_shipping");
    if (error) {
      setScopeError(error);
      return;
    }
    if (!granted) {
      setDeclined(true);
      return;
    }
    shopify.toast.show("write_shipping granted");
    enableFetcher.submit({ intent: "enable-shipping" }, { method: "post" });
  };

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-badge tone="neutral">Shipping module · Off</s-badge>
        <s-button variant="primary" onClick={onClick} {...(busy ? { loading: true } : {})}>
          Enable shipping module
        </s-button>
      </s-stack>
      {declined && (
        <s-text tone="critical">
          write_shipping was declined. That&apos;s fine — try again anytime.
        </s-text>
      )}
      {scopeError && <s-text tone="critical">{scopeError}</s-text>}
    </s-stack>
  );
}

type ShippingMethodRow = {
  id: string;
  name: string;
  priceAmount: string;
  currencyCode: string;
  conditionOperator: string | null;
  conditionAmount: string | null;
};

function conditionSummary(method: ShippingMethodRow): string {
  if (!method.conditionOperator || method.conditionAmount === null) return "—";
  const comparator = method.conditionOperator === "AT_LEAST" ? "≥" : "≤";
  return `if subtotal ${comparator} ${method.conditionAmount} ${method.currencyCode}`;
}

// [DEMO 5] One delete button per row — own fetcher so rows submit independently,
// matching ResyncButton's per-row-fetcher convention in app._index.tsx.
function DeleteMethodButton({ methodId }: { methodId: string }) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.data as { ok?: boolean; intent?: string; error?: string } | undefined;
  const failed = result?.intent === "delete-shipping-method" && result?.ok === false;
  return (
    <s-stack direction="block" gap="small">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="delete-shipping-method" />
        <input type="hidden" name="methodId" value={methodId} />
        <s-button type="submit" variant="tertiary" tone="critical" {...(busy ? { loading: true } : {})}>
          Delete
        </s-button>
      </fetcher.Form>
      {failed && <s-text tone="critical">{result?.error ?? "Delete failed"}</s-text>}
    </s-stack>
  );
}

// [DEMO 5] Once the module is enabled: list existing methods + a form to add one.
// Every new method is applied to every zone in the shop's default delivery profile
// (no zone picker — confirmed scope for this demo).
function ShippingMethodsPanel({ methods }: { methods: ShippingMethodRow[] }) {
  const addFetcher = useFetcher<typeof action>();
  const busy = addFetcher.state !== "idle";
  const addResult = addFetcher.data as { ok?: boolean; intent?: string; error?: string } | undefined;
  const addFailed = addResult?.intent === "add-shipping-method" && addResult?.ok === false;

  return (
    <s-stack direction="block" gap="base">
      <s-badge tone="success">Shipping module · On</s-badge>

      {methods.length === 0 ? (
        <s-text color="subdued">No shipping methods yet.</s-text>
      ) : (
        <s-table variant="auto">
          <s-table-header-row>
            <s-table-header listSlot="primary">Name</s-table-header>
            <s-table-header>Price</s-table-header>
            <s-table-header>Condition</s-table-header>
            <s-table-header>—</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {methods.map((m) => (
              <s-table-row key={m.id}>
                <s-table-cell>{m.name}</s-table-cell>
                <s-table-cell>
                  {m.priceAmount} {m.currencyCode}
                </s-table-cell>
                <s-table-cell>
                  <s-text color="subdued">{conditionSummary(m)}</s-text>
                </s-table-cell>
                <s-table-cell>
                  <DeleteMethodButton methodId={m.id} />
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      )}

      <addFetcher.Form method="post">
        <input type="hidden" name="intent" value="add-shipping-method" />
        <s-stack direction="block" gap="base">
          <s-text-field name="name" label="Method name" required></s-text-field>
          <s-number-field name="priceAmount" label="Price" min={0} step={0.01} required></s-number-field>
          <s-select name="conditionOperator" label="Condition (optional)">
            <s-option value="">No condition</s-option>
            <s-option value="AT_LEAST">Order subtotal at least</s-option>
            <s-option value="AT_MOST">Order subtotal at most</s-option>
          </s-select>
          <s-number-field name="conditionAmount" label="Condition amount" min={0} step={0.01}></s-number-field>
          {addFailed && <s-text tone="critical">{addResult?.error}</s-text>}
          <s-button type="submit" variant="primary" {...(busy ? { loading: true } : {})}>
            Add shipping method
          </s-button>
        </s-stack>
      </addFetcher.Form>
    </s-stack>
  );
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
  const { store, events, currentShop, degraded, shippingMethods } = useLoaderData<typeof loader>();
  // Seamless + instant: new per-store webhook events and field changes appear live.
  useAutoRevalidate(4000);
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

          {/* [DEMO 5] shipping module gate — Off shows the scope-grant button, On shows
              the shipping methods list + add form. */}
          {store.shippingModule ? (
            <ShippingMethodsPanel methods={shippingMethods} />
          ) : (
            <EnableShippingButton />
          )}
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
