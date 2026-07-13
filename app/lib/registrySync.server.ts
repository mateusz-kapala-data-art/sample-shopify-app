import type { Session } from "@shopify/shopify-api";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

// [SLIDE Registry Map] syncStoreRegistry — self-registration + initial sync (REG-01, REG-02).
// Called from hooks.afterAuth in app/shopify.server.ts on every OAuth completion
// (install, reinstall, or revisit) — see RESEARCH Pattern 1 / Pitfall 5.
export async function syncStoreRegistry(
  session: Session,
  admin: AdminApiContext | undefined,
) {
  // Pitfall 4: session/admin can be undefined (e.g. a delayed webhook-driven
  // re-auth without an admin context) — skip the GraphQL call gracefully.
  if (!session || !admin) {
    return;
  }

  const response = await admin.graphql(
    `#graphql
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
      }`,
  );
  const { data } = await response.json();
  const theme = data.themes.nodes[0];

  // Critical: upsert, never create — afterAuth fires on every OAuth completion
  // including reinstalls (REG-01, REG-02; RESEARCH Pitfall 5).
  await db.store.upsert({
    where: { shopifyDomain: session.shop },
    create: {
      shopifyDomain: session.shop,
      primaryDomain: data.shop.primaryDomain?.url ?? null,
      plan: data.shop.plan?.displayName ?? null,
      contactEmail: data.shop.contactEmail ?? null,
      themeName: theme?.name ?? null,
      // themeVersion: no native GraphQL scalar exists (RESEARCH Pitfall 2) —
      // populating it requires a config/settings_schema.json files() read +
      // JSON parse. Deferred to null for Phase 1's walking skeleton; revisit
      // only if the Registry Map slide requires a populated version.
      themeVersion: null,
      grantedScopes: session.scope ?? "",
      status: "active",
      installedAt: new Date(),
      lastSyncedAt: new Date(),
    },
    update: {
      primaryDomain: data.shop.primaryDomain?.url ?? null,
      plan: data.shop.plan?.displayName ?? null,
      status: "active",
      uninstalledAt: null, // reinstall/revisit clears prior uninstall
      lastSyncedAt: new Date(),
    },
  });
}
