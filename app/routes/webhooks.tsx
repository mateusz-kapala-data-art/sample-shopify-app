// [DEMO 2] [SLIDE D1] Single hardened webhook endpoint — all topics + compliance_topics
// route here (HOOK-01..06). HMAC-verify -> idempotent insert -> return 200
// immediately. Application of the event to the registry is deferred to the
// interval worker (app/jobs/processWebhooks.ts) so this action stays fast.
import type { ActionFunctionArgs } from "react-router";
import { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { verifyWebhookHmac } from "../lib/webhookSecrets.server";

// Shopify sends topics in slash form (X-Shopify-Topic: app/uninstalled); the SDK
// normalizes to SCREAMING_SNAKE_CASE (APP_UNINSTALLED), which the worker switches
// on. When we verify via the multi-secret fallback we bypass the SDK, so normalize
// the header ourselves to keep the queued topic shape identical.
function normalizeTopic(raw: string): string {
  return raw.trim().replace(/[/\-.]/g, "_").toUpperCase();
}

export const action = async ({ request }: ActionFunctionArgs) => {
  // SEC-01: read the raw bytes up front so we can HMAC-verify against ALL secrets
  // in the rotation fallback below. Must be the exact raw body (not re-serialized).
  const rawBody = await request.clone().text();

  let topic: string;
  let shop: string;
  let payload: unknown;
  let webhookId: string;

  try {
    // Fast path: the SDK HMAC-verifies against the primary secret and parses the
    // envelope (HOOK-01). Throws/redirects on an invalid or missing signature.
    const verified = await authenticate.webhook(request);
    topic = verified.topic;
    shop = verified.shop;
    payload = verified.payload;
    webhookId = verified.webhookId;
  } catch (authErr) {
    // SEC-01 rotation tolerance: the SDK only knows the primary secret, so a
    // webhook signed with an about-to-be-retired secret fails above. Re-verify
    // against every entry in SHOPIFY_CLIENT_SECRETS before rejecting — rotation
    // stays a config change, not a code change.
    const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");
    if (!verifyWebhookHmac(rawBody, hmacHeader)) {
      // Genuinely unsigned/spoofed or signed with an unknown secret — reject.
      throw authErr;
    }
    topic = normalizeTopic(request.headers.get("X-Shopify-Topic") ?? "");
    shop = request.headers.get("X-Shopify-Shop-Domain") ?? "";
    webhookId = request.headers.get("X-Shopify-Webhook-Id") ?? "";
    payload = rawBody ? JSON.parse(rawBody) : {};
    console.log(`[webhooks] verified ${topic} for ${shop} via rotation fallback (non-primary secret)`);
  }

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
