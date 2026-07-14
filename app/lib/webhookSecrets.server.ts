// [DEMO 3] [SLIDE D2] Multi-secret webhook verification (SEC-01). Rotation is a config
// change, not a code change: SHOPIFY_CLIENT_SECRETS holds a comma-separated list
// of app secrets. Minting/signing uses index 0 (the current primary); incoming
// webhook HMACs are verified against EVERY entry so a webhook signed with an
// about-to-be-retired secret still verifies during the rotation window.
import crypto from "node:crypto";

/**
 * Ordered list of app secrets. Prefers SHOPIFY_CLIENT_SECRETS (comma-separated,
 * index 0 = primary); falls back to the single SHOPIFY_API_SECRET so a one-secret
 * setup keeps working. Empty entries are trimmed out.
 */
export function getWebhookSecrets(): string[] {
  const multi = (process.env.SHOPIFY_CLIENT_SECRETS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (multi.length > 0) return multi;
  const single = process.env.SHOPIFY_API_SECRET?.trim();
  return single ? [single] : [];
}

/** SEC-01: signing/minting always uses the primary (index 0). */
export function getPrimarySecret(): string | undefined {
  return getWebhookSecrets()[0];
}

/**
 * Verify a Shopify webhook HMAC against ALL configured secrets using a
 * timing-safe comparison. `hmacHeader` is the base64 value from the
 * `X-Shopify-Hmac-Sha256` header; `rawBody` MUST be the exact raw request bytes
 * (not re-serialized JSON). Returns true if any secret matches.
 */
export function verifyWebhookHmac(rawBody: string | Buffer, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(hmacHeader, "base64");
  } catch {
    return false;
  }

  for (const secret of getWebhookSecrets()) {
    const digest = crypto.createHmac("sha256", secret).update(rawBody).digest();
    // timingSafeEqual throws on length mismatch — guard it so a wrong-length
    // header can't crash verification; a length mismatch is simply "not a match".
    if (digest.length === expected.length && crypto.timingSafeEqual(digest, expected)) {
      return true;
    }
  }
  return false;
}
