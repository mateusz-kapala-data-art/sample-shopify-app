// [DEMO 1/5] [SLIDE D3] Webhook log — the visible, durable record of every delivery
// that survived HMAC verification. Rows are written by the hardened receiver
// (app/routes/webhooks.tsx) only after the signature checks out; a bad-signature
// request is rejected with 401 and never reaches this table. Read-only, reverse-chron.
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { DeckAnchor, formatSynced } from "../lib/presentation";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const events = await db.webhookEvent.findMany({
    orderBy: { receivedAt: "desc" },
    take: 50,
  });
  return {
    events: events.map((e) => ({
      id: e.id,
      topic: e.topic,
      shop: e.shop,
      receivedAt: e.receivedAt.toISOString(),
      processedAt: e.processedAt ? e.processedAt.toISOString() : null,
    })),
  };
};

export default function WebhookLog() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Webhook log">
      <DeckAnchor>Webhook log · Demo 1/5 · deck section D (slide D3)</DeckAnchor>

      <s-section heading="Recent deliveries">
        {events.length === 0 ? (
          // Empty state doubles as a stage cue: how to make a row appear on demand.
          <s-stack direction="block" gap="base" alignItems="center">
            <s-heading>No deliveries yet</s-heading>
            <s-paragraph>
              Trigger one: rename a dev store, or reinstall the app.
            </s-paragraph>
          </s-stack>
        ) : (
          <s-stack direction="block" gap="base">
            <s-table variant="auto">
              <s-table-header-row>
                <s-table-header listSlot="primary">Topic</s-table-header>
                <s-table-header>Shop</s-table-header>
                <s-table-header>Verdict</s-table-header>
                <s-table-header>Received</s-table-header>
                <s-table-header>Applied</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {events.map((e) => (
                  <s-table-row key={e.id}>
                    <s-table-cell>
                      <s-badge tone="neutral">{e.topic}</s-badge>
                    </s-table-cell>
                    <s-table-cell>{e.shop}</s-table-cell>
                    <s-table-cell>
                      {/* Every stored row is HMAC-verified by design. */}
                      <s-badge tone="success">verified</s-badge>
                    </s-table-cell>
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
            <s-text color="subdued">
              Only HMAC-verified deliveries are stored — requests with a bad
              signature are rejected with 401 before they ever reach this log.
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
