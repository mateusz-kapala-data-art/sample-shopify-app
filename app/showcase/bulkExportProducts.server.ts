// [SHOWCASE] SHOW-06 — "Export all products": kicks off an async bulkOperationRunQuery
// export and completes via the bulk_operations/finish webhook (NOT client-side polling —
// the requirement explicitly forbids it). Status is read from the WebhookEvent row the
// existing pipeline (webhooks.tsx -> processWebhooks.ts) already records, then resolved
// via bulkOperation(id:) using the finish webhook's admin_graphql_api_id — never the
// deprecated currentBulkOperation query (removed-track for 2026-01+, this app is 2026-07).
// No card.scope declared: read_products is already implied by the write_products
// optional scope (05-01's scope drift) that SHOW-04's card requests — if a store has
// never granted write_products, this card's kickoff mutation will surface an
// access-denied GraphQL error rather than a runtime permission prompt (see SUMMARY).
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import type { ActionCard, RunFn } from "./types";

export const BULK_EXPORT_QUERY = `#graphql
  mutation bulkExportProducts {
    bulkOperationRunQuery(
      query: "{ products { edges { node { id title tags } } } }"
    ) {
      bulkOperation {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }`;

const BULK_STATUS_QUERY = `#graphql
  query bulkExportStatus($id: ID!) {
    bulkOperation(id: $id) {
      id
      status
      url
      partialDataUrl
      errorCode
    }
  }`;

export const card: ActionCard = {
  id: "bulk-export",
  category: "Bulk operations",
  title: "Export all products",
  description:
    "Runs bulkOperationRunQuery to export every product; completes via the bulk_operations/finish webhook, not polling.",
  requestKindLabel: "GraphQL bulk operation",
  order: 1,
  preview: BULK_EXPORT_QUERY,
  kind: "bulk",
};

export const run: RunFn = async (admin: AdminApiContext, shop, form) => {
  const op = String(form.get("op") || "start");

  if (op === "status") {
    // The finish webhook is HMAC-verified, deduped, and queued by webhooks.tsx, then
    // recorded (no Store mutation needed) by processWebhooks.ts's BULK_OPERATIONS_FINISH
    // case — this WebhookEvent row IS the durable completion record (RESEARCH Pattern 2).
    const latestEvent = await db.webhookEvent.findFirst({
      where: { shop, topic: "BULK_OPERATIONS_FINISH" },
      orderBy: { receivedAt: "desc" },
    });

    if (!latestEvent) {
      return { data: { status: "none" } };
    }

    const payload = JSON.parse(latestEvent.payload);
    const bulkOperationId = payload.admin_graphql_api_id;

    const response = await admin.graphql(BULK_STATUS_QUERY, {
      variables: { id: bulkOperationId },
    });
    const body: any = await response.json();
    const bulkOperation = body?.data?.bulkOperation;

    return {
      data: {
        status: bulkOperation?.status ?? "none",
        url: bulkOperation?.url,
      },
      extensions: body.extensions,
    };
  }

  // op === "start" (or absent) — kick off the export; RUNNING shows immediately,
  // no client-side polling loop follows.
  const response = await admin.graphql(BULK_EXPORT_QUERY);
  const body: any = await response.json();

  const userErrors = body?.data?.bulkOperationRunQuery?.userErrors ?? [];
  if (userErrors.length > 0) {
    return {
      data: body.data,
      extensions: body.extensions,
      error: userErrors
        .map((e: { message: string }) => e.message)
        .join("; "),
    };
  }

  return {
    data: {
      status: body?.data?.bulkOperationRunQuery?.bulkOperation?.status ?? "RUNNING",
    },
    extensions: body.extensions,
  };
};
