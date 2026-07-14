// [SHOWCASE] SHOW-09 — "Fansifter status check (mock)": GETs the local mock server's
// Fansifter status endpoint and flips the store's dataConnected/fansifterConnected
// registry flags — exactly like the existing toggle-connector idiom (app.registry.tsx),
// just automated, proving these are OUR platform flags, not Shopify data.
import type { ActionCard, RunFn } from "./types";
import db from "../db.server";

// Trusted env only — never take the base URL from request input (SSRF mitigation,
// T-05.05-01). Only `shop` (encoded) is interpolated into the path.
const MOCK_SERVICES_URL = process.env.MOCK_SERVICES_URL ?? "http://localhost:3457";

export const card: ActionCard = {
  id: "fansifter-status",
  category: "Modules (inbound/outbound)",
  title: "Fansifter status check (mock)",
  description:
    "GETs the mock Fansifter server's connection status and flips this store's Data/Fansifter registry chips — no Shopify scope, just our own platform flag.",
  requestKindLabel: "Outbound HTTP GET",
  order: 3,
  preview: "GET " + MOCK_SERVICES_URL + "/fansifter/status/:shop",
};

export const run: RunFn = async (_admin, shop, _form) => {
  const store = await db.store.findUnique({ where: { shopifyDomain: shop } });
  if (!store) {
    return { error: "Store not found in registry" };
  }

  const response = await fetch(
    `${MOCK_SERVICES_URL}/fansifter/status/${encodeURIComponent(shop)}`,
  );
  const body: any = await response.json();

  await db.store.update({
    where: { shopifyDomain: shop },
    data: {
      fansifterConnected: !!body.connected,
      dataConnected: !!body.connected,
    },
  });

  return { data: body };
};
