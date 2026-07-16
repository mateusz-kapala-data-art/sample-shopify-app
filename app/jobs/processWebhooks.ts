// [DEMO 2] [SLIDE D1] WebhookEvent application (HOOK-03..06). On Vercel (serverless)
// there is no long-lived process, so app/routes/webhooks.tsx applies each event INLINE
// via applyWebhookEvent() right after the idempotent insert. Locally, the interval
// worker below is a backstop that drains anything the inline path missed. Both share
// applyWebhookEvent so the switch lives in one place.
import db from "../db.server";
import { handleComplianceEvent } from "../lib/compliance.server";
import { isDegraded, evictAdminToken } from "../lib/tokenService.server";

// globalThis-guarded singleton — same idiom as app/db.server.ts's Prisma
// client guard — so Vite dev-server HMR never spawns a second interval.
declare global {
  // eslint-disable-next-line no-var
  var webhookWorkerStarted: boolean | undefined;
}

// WR-01: retry transient failures instead of silently dropping them. In-memory
// attempt counter (keyed by webhookId) — no schema column needed for the walking
// skeleton; resets on restart. A poison-pill payload (malformed JSON etc.) is still
// eventually skipped after MAX_ATTEMPTS so it never blocks the queue (the original
// DoS-skip intent), but a real DB/network blip now retries on the next tick.
const MAX_ATTEMPTS = 3;
const attempts = new Map<string, number>();

// Apply one webhook to the registry. NOTE: topic arrives in SCREAMING_SNAKE_CASE
// (authenticate.webhook() / normalizeTopic), not the toml's slash form. No token
// service is used here, so this runs fine inline on serverless (no degraded gate).
export async function applyWebhookEvent(event: {
  id: string;
  topic: string;
  shop: string;
  payload: string;
}): Promise<void> {
  switch (event.topic) {
    case "APP_UNINSTALLED": {
      await db.store.updateMany({
        where: { shopifyDomain: event.shop },
        data: { uninstalledAt: new Date(), status: "uninstalled" },
      });
      // Wipe the shop's stored access-token/session rows (HOOK-05) and evict any
      // cached admin token (SEC-02) so a stale token is never reused after uninstall.
      await db.session.deleteMany({ where: { shop: event.shop } });
      evictAdminToken(event.shop);
      break;
    }
    case "SHOP_UPDATE": {
      // [Assumption A3 — RESEARCH.md] exact 2026-07 field names are unconfirmed; an
      // end-of-phase human check captures a real payload and adjusts this mapping.
      const payload = JSON.parse(event.payload);
      await db.store.updateMany({
        where: { shopifyDomain: event.shop },
        data: {
          primaryDomain: payload.domain ?? undefined,
          plan: payload.plan_display_name ?? payload.plan_name ?? undefined,
        },
      });
      break;
    }
    case "APP_SCOPES_UPDATE": {
      const payload = JSON.parse(event.payload);
      const current = (payload.current as string[]) ?? [];
      // Keep the Session's scope current (behavior the deleted scopes_update route had).
      await db.session.updateMany({
        where: { shop: event.shop },
        data: { scope: current.toString() },
      });
      // WR-09: Shopify's authoritative scope-change signal — reconcile the persisted
      // grant state so the registry converges to real grants regardless of what the
      // client round-tripped. updateMany is a no-op if the store row is absent.
      await db.store.updateMany({
        where: { shopifyDomain: event.shop },
        data: { grantedScopes: current.join(",") },
      });
      break;
    }
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      await handleComplianceEvent(event.topic, event.shop, event.payload);
      break;
    default:
      break;
  }
}

async function drainQueue() {
  // SEC-04: pause job processing while the token service is degraded (an
  // invalid_client grant tripped the flag). Events stay queued (processedAt null)
  // and drain once credentials are fixed and the flag clears. Logged loudly so the
  // pause is visible in job logs, per ROADMAP Phase 2 SC4.
  if (isDegraded()) {
    console.warn("[processWebhooks] DEGRADED — job processing paused; leaving events queued until credentials recover");
    return;
  }

  const pending = await db.webhookEvent.findMany({
    where: { processedAt: null },
    orderBy: { receivedAt: "asc" },
    take: 20,
  });

  for (const event of pending) {
    try {
      await applyWebhookEvent(event);
    } catch (err) {
      const tries = (attempts.get(event.id) ?? 0) + 1;
      attempts.set(event.id, tries);
      if (tries < MAX_ATTEMPTS) {
        // Transient failure — leave processedAt null so the next tick retries.
        // Also keeps one malformed/oversized payload from halting the drain loop
        // (V5/V13 DoS mitigation): the loop continues to the next event.
        console.error(
          `[processWebhooks] apply failed for event ${event.id} (${event.topic}), attempt ${tries}/${MAX_ATTEMPTS} — will retry`,
          err,
        );
        continue;
      }
      // Exhausted retries — treat as a poison pill: mark processed so it stops
      // blocking the queue, and log loudly since a real change may have been lost.
      console.error(
        `[processWebhooks] giving up on event ${event.id} (${event.topic}) after ${tries} attempts — marking processed to drain the queue`,
        err,
      );
    }

    attempts.delete(event.id);
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
  }
}

export function startWebhookWorker(intervalMs = 5000) {
  if (global.webhookWorkerStarted) return; // guard against Vite HMR re-running this module
  global.webhookWorkerStarted = true;
  setInterval(() => {
    drainQueue().catch((err) => console.error("[processWebhooks] drain failed", err));
  }, intervalMs);
}
