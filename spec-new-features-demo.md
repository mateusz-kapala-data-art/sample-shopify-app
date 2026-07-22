# Build spec — Web pixel + Flow trigger extensions (Mateusz's split)

For Claude Code. Adds two extensions to the existing "Platform App (Demo)" repo (Remix template, scaffolded via `shopify app init`). Fazal builds the admin block + Cart Transform Function separately — do not touch those. Base context: `demo-app-spec.md`, `demo-app-range-addendum.md` (R2, R3).

## Constraints (both extensions)

- One screenful of code each (~40 lines max per source file) — they'll be shown in an editor on stage.
- CLI-generated scaffolds, trimmed — no hand-rolled config.
- No new npm deps beyond what the templates bring.
- No persistence beyond the session; no external network calls.
- Everything named to read well on a projector: clear ids, no `test`/`foo`.

## 1. Web pixel — `extensions/release-pixel`

Generate:
```
shopify app generate extension --template web_pixel_extension --name release-pixel
```

Behavior (`src/index.js`):
- `register(({ analytics }) => …)` subscribing to exactly two events:
  - `product_viewed` → `console.log('[release-pixel] product_viewed', { title, price })` pulled from `event.data.productVariant`.
  - `checkout_completed` → `console.log('[release-pixel] checkout_completed', { orderId, totalPrice })` from `event.data.checkout`.
- Log payloads must be small, flat objects — readable in devtools on stage.
- No settings/fields needed in `shopify.extension.toml` beyond scaffold defaults; keep `privacy` settings as generated (analytics: true, marketing/preferences: false).

Activation (document in the extension's README.md, ~5 lines):
- Pixels require activation per store via the Admin GraphQL `webPixelCreate` mutation (settings `{}`), or note that `app deploy` + the pixel settings page handles it.
- Add a one-off script or a documented `shopify app function` — simplest acceptable: a curl/GraphiQL snippet in the README that the presenter runs once per dev store in prep.

Demo acceptance:
- Open a product on the dev storefront → `product_viewed` visible in browser console.
- Complete a test checkout → `checkout_completed` visible (pixels survive into checkout — that's the talking point).

## 2. Flow trigger — `extensions/flow-release-live`

Generate:
```
shopify app generate extension --template flow_trigger --name flow-release-live
```

Trigger definition (`shopify.extension.toml`):
- Handle/title: `release-went-live` / "Release went live".
- Description: "Fires when a release's street date passes."
- Properties (keep to 3, flat):
  - `release_title` (string)
  - `catalog_number` (string)
  - `street_date` (string, ISO date)

Server-side firing — add ONE route to the Remix app, `app/routes/app.flow-demo.tsx`:
- A Polaris `Page` with a single `Card` + `Button` "Fire 'Release went live'".
- Action handler POSTs the Flow trigger via Admin GraphQL `flowTriggerReceive` mutation with hard-coded payload: `{ release_title: "Midnight Static — LP", catalog_number: "SME-4417", street_date: "2026-07-24" }`.
- On success: toast "Trigger fired — check Flow run log". On error: toast with the GraphQL error message.
- Keep the route out of the main nav (direct URL only) — it's a demo rig, not a feature. Header subline: "Shown with the range tour (Demo 1b)".

Flow workflow (manual prep, document in extension README.md):
- On a dev store: Flow → create workflow → trigger "Release went live" → action "Add product tags" (tag: `went-live`) or "Send internal email". Save + turn on.
- Note: the trigger only appears in Flow after `shopify app deploy` and app install on that store.

Demo acceptance:
- Click the button on `/app/flow-demo` → Flow run log on the dev store shows a run within seconds → tag/email visible.

## 3. Deploy & versioning

- Both extensions ship via the normal `shopify app deploy` — no separate release path. They must be present in the next deployed version so Demo 4's version history includes them.
- Scopes: pixel activation needs `write_pixels` (+ `read_customer_events` if the template requires); `flowTriggerReceive` needs no extra scope. Add to `shopify.app.toml` [access_scopes] — note this WILL trigger per-store re-approval on already-installed stores (that's fine; it's slide I2's story).

## 4. Out of scope

Admin block, Cart Transform Function (Fazal). Storing pixel events. Real street-date scheduling (button-fired only). Any UI beyond the one flow-demo route.
