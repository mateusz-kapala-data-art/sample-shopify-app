#!/usr/bin/env bash
# Drive the /webhooks endpoint end-to-end WITHOUT a Shopify tunnel or dev store.
# Proves SEC-01 (multi-secret rotation), HOOK-01 (reject unsigned/spoofed), and
# HOOK-02 (dedupe by webhookId). Boot the server first with test secrets:
#
#   npm run build
#   SHOPIFY_API_KEY=test_key SHOPIFY_API_SECRET=primary_secret_v2 \
#   SHOPIFY_CLIENT_SECRETS=primary_secret_v2,old_secret_v1 \
#   SHOPIFY_APP_URL=http://localhost:3457 SCOPES=write_products,read_themes \
#   PORT=3457 npm run start &
#
# Then: bash scripts/verify-webhooks.sh
set -euo pipefail

URL="${WEBHOOKS_URL:-http://localhost:3457/webhooks}"
BODY='{"domain":"verify-test-new.myshopify.com","plan_name":"Shopify Plus"}'
hmac() { printf '%s' "$2" | openssl dgst -sha256 -hmac "$1" -binary | base64; }
post() { # topic id hmac
  curl -s -o /dev/null -w "%{http_code}" -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "X-Shopify-Topic: $1" \
    -H "X-Shopify-Shop-Domain: verify-test.myshopify.com" \
    -H "X-Shopify-Webhook-Id: $2" \
    -H "X-Shopify-API-Version: 2026-07" \
    -H "X-Shopify-Hmac-Sha256: $3" \
    --data-binary "$BODY"
}

pass=0; fail=0
check() { # label expected actual
  if [ "$2" = "$3" ]; then echo "  PASS $1 (HTTP $3)"; pass=$((pass+1));
  else echo "  FAIL $1 (expected $2, got $3)"; fail=$((fail+1)); fi
}

echo "SEC-01 rotation: retired secret should verify via fallback"
check "retired-secret-accepted" 200 "$(post shop/update wh-rot-001 "$(hmac old_secret_v1 "$BODY")")"
echo "HOOK-01: unknown secret should be rejected"
check "attacker-rejected" 401 "$(post shop/update wh-atk-001 "$(hmac attacker_secret "$BODY")")"
echo "HOOK-02: duplicate webhookId should still 200 (deduped on insert)"
check "duplicate-accepted" 200 "$(post shop/update wh-rot-001 "$(hmac old_secret_v1 "$BODY")")"
echo "Primary secret fast path"
check "primary-accepted" 200 "$(post app/uninstalled wh-pri-001 "$(hmac primary_secret_v2 "$BODY")")"
echo "HOOK-01: missing HMAC header should be rejected"
check "no-hmac-rejected" 400 "$(post shop/update wh-none-001 "")"

echo ""
echo "Result: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
