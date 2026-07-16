import type { Session } from "@shopify/shopify-api";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { getAdminToken, adminApiVersion } from "./tokenService.server";

// [SLIDE D1] The registry sync query — character-identical to the deck's Slide D1
// (also mirrored in app/routes/app._index.tsx's loader, UI-04). Shared by the
// afterAuth path (admin context) and the re-sync path (client-credentials token).
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

type ShopData = {
  primaryDomain?: { url?: string | null } | null;
  plan?: { displayName?: string | null } | null;
  contactEmail?: string | null;
} | undefined;

// Single upsert path shared by both sync entrypoints. `grantedScopes` is optional:
// when undefined (a re-sync, which has no session) the granted-scopes column is left
// untouched; the afterAuth path passes session.scope to refresh it.
async function upsertStoreRow(
  shopDomain: string,
  shop: ShopData,
  themeName: string | null,
  grantedScopes: string | undefined,
) {
  await db.store.upsert({
    where: { shopifyDomain: shopDomain },
    create: {
      shopifyDomain: shopDomain,
      primaryDomain: shop?.primaryDomain?.url ?? null,
      plan: shop?.plan?.displayName ?? null,
      contactEmail: shop?.contactEmail ?? null,
      themeName: themeName ?? null,
      // themeVersion: no native GraphQL scalar (RESEARCH Pitfall 2) — deferred to null.
      themeVersion: null,
      grantedScopes: grantedScopes ?? "",
      status: "active",
      installedAt: new Date(),
      lastSyncedAt: new Date(),
    },
    update: {
      primaryDomain: shop?.primaryDomain?.url ?? null,
      plan: shop?.plan?.displayName ?? null,
      contactEmail: shop?.contactEmail ?? null,
      // A re-sync must reflect a live theme rename — previously omitted here, so the
      // registry never updated the theme name on re-sync. `?? undefined` = leave the
      // stored name untouched if this fetch couldn't read one (don't clobber on a hiccup).
      themeName: themeName ?? undefined,
      status: "active",
      uninstalledAt: null, // reinstall/revisit clears prior uninstall
      lastSyncedAt: new Date(),
      ...(grantedScopes !== undefined ? { grantedScopes } : {}),
    },
  });
}

// [DEMO 1] [SLIDE Registry Map] syncStoreRegistry — self-registration + initial sync (REG-01,
// REG-02). Called from hooks.afterAuth on every OAuth completion (install, reinstall,
// or revisit) — see RESEARCH Pattern 1 / Pitfall 5.
export async function syncStoreRegistry(
  session: Session,
  admin: AdminApiContext | undefined,
) {
  // Pitfall 4: session/admin can be undefined — skip the GraphQL call gracefully.
  if (!session || !admin) {
    return;
  }

  // CR-01 guard: a GraphQL error returns { errors, data: null } and a network hiccup
  // throws; neither must crash afterAuth (no surrounding try/catch there). Degrade to
  // a null-field row rather than throwing so the store is always durably registered.
  let shop: ShopData;
  let themeName: string | null = null;
  try {
    const response = await admin.graphql(REGISTRY_QUERY);
    const body: any = await response.json();
    if (body?.errors) console.error("registrySync: GraphQL returned errors", body.errors);
    shop = body?.data?.shop;
    themeName = body?.data?.themes?.nodes?.[0]?.name ?? null;
  } catch (error) {
    console.error("registrySync: initial sync query failed, writing degraded row", error);
  }

  // upsert, never create — afterAuth fires on every OAuth including reinstalls.
  await upsertStoreRow(session.shop, shop, themeName, session.scope ?? "");
}

// [SLIDE D2] UI-02: re-sync a store on demand using the client-credentials Admin
// token (from the token service) — NOT an embedded session token — so a background
// operator action can refresh any registered store. A bad app credential trips the
// SEC-04 degraded flag inside getAdminToken and this rethrows for the caller to show.
export async function resyncStore(shopDomain: string): Promise<void> {
  const token = await getAdminToken(shopDomain);
  const res = await fetch(
    `https://${shopDomain}/admin/api/${adminApiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query: REGISTRY_QUERY }),
    },
  );
  const body: any = await res.json().catch(() => ({}));
  if (body?.errors) {
    console.error(`resyncStore: GraphQL errors for ${shopDomain}`, body.errors);
  }
  await upsertStoreRow(
    shopDomain,
    body?.data?.shop,
    body?.data?.themes?.nodes?.[0]?.name ?? null,
    undefined, // re-sync has no session; leave grantedScopes untouched
  );
}
