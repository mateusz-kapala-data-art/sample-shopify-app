// [SLIDE D1] Single hardened webhook endpoint — all topics + compliance_topics
// route here (HOOK-01..06). HMAC-verify -> idempotent insert -> return 200
// immediately. Application of the event to the registry is deferred to the
// interval worker (app/jobs/processWebhooks.ts) so this action stays fast.
import type { ActionFunctionArgs } from "react-router";
import { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // authenticate.webhook() HMAC-verifies the request and throws/redirects on an
  // invalid or missing signature before we ever touch the database (HOOK-01).
  const { topic, shop, payload, webhookId } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    await db.webhookEvent.create({
      data: {
        id: webhookId, // Shopify's own idempotency key — unique constraint enforces dedupe
        topic,
        shop,
        payload: JSON.stringify(payload),
        receivedAt: new Date(),
      },
    });
  } catch (err) {
    // P2002 = unique constraint violation = duplicate delivery. Shopify webhooks
    // are at-least-once, so a repeat delivery is expected and not an error (HOOK-02).
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }
  }

  // HOOK-03: return 200 immediately — no Store mutations here. The interval
  // worker (app/jobs/processWebhooks.ts) applies the event asynchronously.
  return new Response();
};
