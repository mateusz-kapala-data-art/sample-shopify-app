# Demo reset checklist

[DEMO-02] Manual state-restore process so the six live demos can be rehearsed and
reset to a clean slate before the session. Run top-to-bottom; it takes ~5 minutes.

> Reset target: **zero registered stores**, a **fresh dev store** with no prior
> install, and the **platform-badge** extension back on its baseline version.

## 0. Before you start

- [ ] Confirm you are on the **demo dev store**, never a production store.
- [ ] `git status` is clean (no half-finished edits from a prior rehearsal).
- [ ] `.env` has a valid `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and
      `SHOPIFY_CLIENT_SECRETS` (index 0 = the current primary secret).
- [ ] Do **not** rotate the client secret within a week of the session — webhook
      HMAC signing can lag up to an hour after rotation.

## 1. Uninstall from the dev store

- [ ] In the dev store admin: **Settings → Apps and sales channels → Sony Platform
      App (Demo) → Uninstall.**
- [ ] Uninstall fires `app/uninstalled`; the worker sets `uninstalledAt` +
      `status="uninstalled"` on the Store row and deletes the shop's Session rows.

## 2. Clear the local registry (zero rows)

Two options — pick one:

- **Fast (wipe dev DB):**
  - [ ] Stop the dev server.
  - [ ] `rm prisma/dev.sqlite`
  - [ ] `npx prisma migrate deploy` (recreates Store, WebhookEvent, Session tables)
- **Surgical (keep other data):**
  - [ ] `npx prisma studio` → delete all rows in **Store** and **WebhookEvent**.

- [ ] Verify **row count = 0**: open `/app/registry` (after reinstall in step 4) or
      `npx prisma studio` and confirm the Store table is empty.

## 3. Reset the storefront badge to baseline

- [ ] In `extensions/platform-badge/blocks/platform-badge.liquid`, set
      `BADGE_TEXT` back to `'Connected to Sony Platform · v1'`.
- [ ] `shopify app deploy` and release the version so the storefront shows the
      baseline text. (The live demo is bumping `v1 → v2` and redeploying.)

## 4. Reinstall clean

- [ ] `npm run dev` and open the app install link on the fresh dev store.
- [ ] Install → `hooks.afterAuth` self-registers exactly **one** Store row.
- [ ] Open `/app/registry` and confirm **exactly one row**, status `active`,
      populated domain/plan/theme, module badge **Off**, and no degraded banner.

## 5. Pre-flight for the six demos

- [ ] **DEMO 1** (install → row): the row from step 4 is the payoff — leave it.
- [ ] **DEMO 2** (webhook verify/dedupe/apply): have the Partner Dashboard webhook
      replay handy for one topic (e.g. `shop/update`).
- [ ] **DEMO 3** (secret rotation): note the current `SHOPIFY_CLIENT_SECRETS` order;
      the demo adds a second secret and verifies a webhook still passes.
- [ ] **DEMO 4** (token + degraded): know how to force an `invalid_client` (bad
      secret) to flip the degraded banner, and how to recover (fix secret → next
      mint auto-clears it).
- [ ] **DEMO 5** (registry UI / re-sync / runtime scope): confirm **Run re-sync
      now** works and **Enable shipping module** opens the `write_shipping` grant
      modal. After granting, add a shipping method (name + price + optional
      subtotal condition) and confirm it appears in Shopify admin's Settings →
      Shipping and delivery on the default profile's zones.
- [ ] **DEMO 6** (storefront badge): the `platform-badge` block is added to the dev
      store theme (Theme editor → add app block) so the deploy diff is visible.

## Waypoints (Cmd+P targets)

Every demo stop carries a `// [DEMO n]` / `// [SLIDE Xn]` comment:

| Demo | Where | Marker |
|------|-------|--------|
| 1 | `app/lib/registrySync.server.ts` | `[DEMO 1]` self-registration + sync |
| 2 | `app/routes/webhooks.tsx`, `app/jobs/processWebhooks.ts` | `[DEMO 2]` verify → dedupe → apply |
| 3 | `app/lib/webhookSecrets.server.ts` | `[DEMO 3]` multi-secret rotation |
| 4 | `app/lib/tokenService.server.ts` | `[DEMO 4]` token cache + degraded mode |
| 5 | `app/routes/app.registry.$shop.tsx`, `app/lib/shippingModule.server.ts` | `[DEMO 5]` registry UI + runtime scope + shipping method CRUD |
| 6 | `extensions/platform-badge/blocks/platform-badge.liquid` | `[DEMO 6]` storefront badge |

## Screenshot fallbacks

- [ ] Have a screenshot of each payoff state (registry row, degraded banner, grant
      modal, storefront badge, add-shipping-method form + result, and the new rate
      showing in Shopify admin's Settings → Shipping and delivery) in case live
      delivery fails.
