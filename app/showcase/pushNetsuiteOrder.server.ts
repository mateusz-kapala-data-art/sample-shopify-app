// [SHOWCASE] SHOW-08 — "Push order to NetSuite (mock)": reads the shop's latest order
// (needs read_orders, optional per 05-01's toml drift), normalizes it, POSTs it to the
// local mock server's /netsuite/orders endpoint, and persists Store.netsuiteLastPush —
// the exact "fetch external → parse .json() → persist to db.store" sequencing already
// proven by app/lib/registrySync.server.ts's resyncStore() (lines 99-122).
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ActionCard, RunFn } from "./types";
import db from "../db.server";

// Trusted env only — never take the mock base URL from request input (SSRF
// mitigation, T-05.08-01). Only normalized order data is sent to it.
const MOCK_SERVICES_URL = process.env.MOCK_SERVICES_URL ?? "http://localhost:3457";

export const LATEST_ORDER_QUERY = `#graphql
  query latestOrder {
    orders(first: 1, reverse: true) {
      nodes {
        id
        name
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
    }
  }`;

export const card: ActionCard = {
  id: "push-netsuite",
  category: "Modules (inbound/outbound)",
  title: "Push order to NetSuite (mock)",
  description:
    "Reads the shop's latest order and POSTs a normalized payload to the mock NetSuite server, then updates the NetSuite last-push timestamp.",
  requestKindLabel: "GraphQL read → Outbound HTTP POST",
  order: 2,
  preview: `${LATEST_ORDER_QUERY}\n\nPOST ${MOCK_SERVICES_URL}/netsuite/orders`,
  scope: "read_orders",
};

export const run: RunFn = async (admin: AdminApiContext, shop, _form) => {
  const response = await admin.graphql(LATEST_ORDER_QUERY);
  const body: any = await response.json();
  const order = body?.data?.orders?.nodes?.[0] ?? null;
  // Never push a null order and call it a success — the registry timestamp must
  // mean "an order really landed."
  if (!order) {
    return { error: "No orders found to push — seed a demo order first." };
  }

  const mockRes = await fetch(`${MOCK_SERVICES_URL}/netsuite/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop, order }),
  });

  // fetch only rejects on network failure — a 404/422/500 resolves with ok: false.
  // Gate the timestamp on a verified 2xx so the registry never shows a push that
  // never landed ("no fakes").
  const text = await mockRes.text();
  if (!mockRes.ok) {
    return {
      data: { order, status: mockRes.status, body: text },
      error: `NetSuite mock returned ${mockRes.status} — push not recorded. Is mock-services running?`,
    };
  }
  const mockResponse: any = text ? JSON.parse(text) : {};

  await db.store.update({
    where: { shopifyDomain: shop },
    data: { netsuiteLastPush: new Date() },
  });

  return { data: { order, mockResponse }, extensions: body.extensions };
};
