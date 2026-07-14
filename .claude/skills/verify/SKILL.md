---
name: verify
description: Build and drive this Shopify app's server surfaces to observe changes at runtime, without a Shopify tunnel or dev store.
---

# Verify — Sony Platform App (Demo)

Runtime observation for this app. The embedded UI (registry page, App Bridge
scopes) and OAuth/afterAuth need a live `shopify app dev` tunnel + Partner dev
store — those are the presenter's live smoke test. But the **`/webhooks` server
endpoint is fully driveable headless**, and it covers the highest-risk logic:
multi-secret HMAC rotation (SEC-01), reject-unsigned (HOOK-01), and dedupe
(HOOK-02).

## Build + boot with test secrets

```bash
npm run build
SHOPIFY_API_KEY=test_key \
SHOPIFY_API_SECRET=primary_secret_v2 \
SHOPIFY_CLIENT_SECRETS=primary_secret_v2,old_secret_v1 \
SHOPIFY_APP_URL=http://localhost:3457 \
SCOPES=write_products,read_themes \
PORT=3457 \
npm run start > /tmp/verify-server.log 2>&1 &
sleep 4   # wait for react-router-serve to bind
```

Key trick: the SDK's `authenticate.webhook()` only knows `SHOPIFY_API_SECRET`
(the primary). Putting a *second* secret in `SHOPIFY_CLIENT_SECRETS` and signing a
request with it exercises the rotation-fallback path in `app/routes/webhooks.tsx`.

## Drive it

```bash
WEBHOOKS_URL=http://localhost:3457/webhooks bash scripts/verify-webhooks.sh
```

Expected: `5 passed, 0 failed`. The script signs requests with `openssl dgst
-sha256 -hmac <secret> -binary | base64` and asserts status codes (200 rotation
accept, 401 attacker, 200 dupe, 200 primary, 400 no-hmac).

## Confirm the internals (server log + DB)

```bash
grep -iE 'rotation fallback|Received .* webhook' /tmp/verify-server.log
# DB: dedupe (one row per webhookId) + worker applied (processedAt set)
node -e 'const{PrismaClient}=require("@prisma/client");const db=new PrismaClient();(async()=>{
  const e=await db.webhookEvent.findMany({orderBy:{receivedAt:"asc"}});
  console.log(e.map(x=>`${x.id} ${x.topic} ${x.processedAt?"APPLIED":"pending"}`));
  await db.$disconnect();})();'
```

## Tear down (always)

```bash
pkill -f "react-router-serve ./build/server/index.js"
# clean the verify rows so dev.sqlite isn't polluted
node -e 'const{PrismaClient}=require("@prisma/client");const db=new PrismaClient();(async()=>{
  await db.webhookEvent.deleteMany({where:{shop:"verify-test.myshopify.com"}});await db.$disconnect();})();'
```

## What still needs a live dev store (NOT headless-verifiable)

- afterAuth self-registration (install → Store row) — needs OAuth
- Registry page table / re-sync button / degraded banner — needs App Bridge + embed
- `write_shipping` runtime scope grant modal — needs App Bridge
- SEC-04 degraded mode — needs a real `invalid_client` from Shopify's token endpoint
- Storefront badge deploy/redeploy — needs `shopify app deploy` + theme editor

Run those from `npm run dev` per `scripts/demo-reset.md`.

## Gotchas

- Theme app extension **blocks** cannot contain inline `{% stylesheet %}` tags —
  CSS goes in `assets/*.css` referenced by the schema `"stylesheet"` key.
- Don't `typecheck`/`lint` as a substitute for booting — this app's real bugs
  (e.g. the `optional_scopes` TOML array, the extension stylesheet tag) only
  surface at build/deploy/runtime, not in `tsc`.
