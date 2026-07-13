// [SLIDE D1] Interval worker — drains WebhookEvent (queued by
// app/routes/webhooks.tsx) and applies each event to the registry
// (HOOK-03..06). Decouples "acknowledge fast" (the route's immediate 200)
// from "apply slow" (this worker's DB/GraphQL-adjacent work).
import db from "../db.server";
import { handleComplianceEvent } from "../lib/compliance.server";

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

async function drainQueue() {
  const pending = await db.webhookEvent.findMany({
    where: { processedAt: null },
    orderBy: { receivedAt: "asc" },
    take: 20,
  });

  for (const event of pending) {
    try {
      // NOTE: authenticate.webhook() returns topic in SCREAMING_SNAKE_CASE
      // (e.g. APP_UNINSTALLED), not the toml's slash form (app/uninstalled).
      switch (event.topic) {
        case "APP_UNINSTALLED": {
          await db.store.updateMany({
            where: { shopifyDomain: event.shop },
            data: { uninstalledAt: new Date(), status: "uninstalled" },
          });
          // Wipe the shop's stored access-token/session rows (HOOK-05).
          // [Phase 2] in-memory admin-token cache eviction is added alongside
          // getAdminToken(shop) — no such cache exists yet in Phase 1.
          await db.session.deleteMany({ where: { shop: event.shop } });
          break;
        }
        case "SHOP_UPDATE": {
          // [Assumption A3 — RESEARCH.md] exact 2026-07 field names are
          // unconfirmed; end-of-phase human check captures a real payload
          // and this mapping is adjusted if it differs.
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
          // Preserve the behavior the deleted scopes_update route had — no
          // Store change required in Phase 1, only the Session's scope.
          await db.session.updateMany({
            where: { shop: event.shop },
            data: { scope: current.toString() },
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
