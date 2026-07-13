// [SLIDE D2] Admin token service — client-credentials grant + in-memory cache
// (SEC-02), redacted logging (SEC-03), and a degraded flag that pauses jobs when
// credentials go bad (SEC-04). Background jobs that need Admin API access call
// getAdminToken(shop) instead of relying on a stored OAuth session token.
import { ApiVersion } from "@shopify/shopify-app-react-router/server";
import { getPrimarySecret } from "./webhookSecrets.server";

// Pinned 2026-07 Admin API surface (matches app/shopify.server.ts). Imported from
// the SDK directly rather than from shopify.server to avoid a circular import
// (registrySync -> tokenService -> shopify.server -> registrySync).
export const adminApiVersion = ApiVersion.July26;

// SEC-03: every log line about a token passes through redact() so a raw token
// never lands in application logs. Shows a short non-reversible fingerprint only.
export function redact(token: string | undefined | null): string {
  if (!token) return "<none>";
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}…${token.slice(-2)} (len ${token.length})`;
}

// SEC-04: module-level degraded flag. Set when the client-credentials grant is
// rejected with invalid_client (bad/rotated app secret). While degraded, jobs
// pause (see app/jobs/processWebhooks.ts) and Phase 3's registry page shows a
// red banner. Kept module-scoped on purpose so one bad credential trips the
// whole platform loudly rather than failing silently per-shop.
let degraded = false;
export function isDegraded(): boolean {
  return degraded;
}
// Recovery hook (used after a secret is fixed — e.g. Phase 3 re-sync / manual clear).
export function clearDegraded(): void {
  if (degraded) console.warn("[tokenService] degraded flag cleared — resuming normal operation");
  degraded = false;
}

type CachedToken = { token: string; expiresAt: number };
// In-memory cache keyed by shop domain (SEC-02). Not persisted — a restart just
// re-mints. Refreshed slightly early so a token never expires mid-request.
const tokenCache = new Map<string, CachedToken>();
const EARLY_REFRESH_MS = 60_000; // re-mint 60s before actual expiry
const DEFAULT_TTL_S = 24 * 60 * 60; // 24h — Shopify client-credentials default

/**
 * SEC-02: return a valid Admin API access token for `shop`, reusing the cached
 * token across calls within its 24h window instead of re-requesting a grant.
 * Throws on failure; sets the degraded flag (SEC-04) on invalid_client.
 */
export async function getAdminToken(shop: string): Promise<string> {
  const cached = tokenCache.get(shop);
  if (cached && cached.expiresAt - EARLY_REFRESH_MS > Date.now()) {
    console.log(`[tokenService] cache hit for ${shop} -> ${redact(cached.token)}`);
    return cached.token;
  }

  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = getPrimarySecret(); // SEC-01: minting uses index 0
  if (!clientId || !clientSecret) {
    throw new Error("[tokenService] missing SHOPIFY_API_KEY or SHOPIFY_CLIENT_SECRETS/SHOPIFY_API_SECRET");
  }

  const url = `https://${shop}/admin/oauth/access_token`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });
  } catch (err) {
    console.error(`[tokenService] network error minting token for ${shop}`, err);
    throw err;
  }

  const body: any = await res.json().catch(() => ({}));

  // SEC-04: invalid_client means the app credential is bad/rotated out — trip the
  // degraded flag so jobs pause and the failure is visible, then surface it.
  if (!res.ok || body?.error) {
    if (body?.error === "invalid_client" || res.status === 401) {
      degraded = true;
      console.error(
        `[tokenService] invalid_client for ${shop} — DEGRADED MODE ON (jobs paused). Check SHOPIFY_CLIENT_SECRETS[0].`,
      );
    } else {
      console.error(`[tokenService] token grant failed for ${shop}: ${res.status} ${body?.error ?? ""}`);
    }
    throw new Error(`token grant failed for ${shop}: ${body?.error ?? res.status}`);
  }

  const token: string = body.access_token;
  const ttlS: number = typeof body.expires_in === "number" ? body.expires_in : DEFAULT_TTL_S;
  const expiresAt = Date.now() + ttlS * 1000;
  tokenCache.set(shop, { token, expiresAt });

  // A successful mint proves the credential works again — auto-clear degraded.
  if (degraded) clearDegraded();

  // Version pin is threaded through so callers using this token hit the same
  // 2026-07 Admin API surface as the rest of the app (see shopify.server.ts).
  console.log(
    `[tokenService] minted token for ${shop} -> ${redact(token)}, ttl ${ttlS}s (api ${adminApiVersion})`,
  );
  return token;
}

// Test/utility hook — clear a shop's cached token (e.g. after uninstall wipes the
// shop) so a stale token is never reused. Called from the uninstall path.
export function evictAdminToken(shop: string): void {
  if (tokenCache.delete(shop)) {
    console.log(`[tokenService] evicted cached token for ${shop}`);
  }
}
