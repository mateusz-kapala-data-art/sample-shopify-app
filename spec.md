# Demo App Spec — "Platform App (Demo)"

Purpose: one small, real app that carries all six live demos (plus optional demo 7) in the "How Shopify apps work" session. It is a thin slice of the future Sony Music Platform App — same stack, same auth model, same repo shape — so everything shown on stage transfers 1:1 to the real project.

## 1. Ground rules

- Built from the **React Router app template, TypeScript**, hosted the way we'd host the real app (our infra or a temporary host — anything with a stable public URL).
- **Auth: client credentials grant only.** No offline tokens anywhere, matching the decided model.
- **Distribution: custom**, scoped to our Plus dev/test org. Installed only on **dev stores** — never a production store.
- Created in the **Dev Dashboard** under our org, with the whole audience team given access before the session (needed for Demo 2).
- Two app records: `platform-demo` (used on stage) and `platform-demo-staging` (used once, to rehearse secret rotation before the session — not shown).

## 2. Repo contents

```
shopify.app.toml          ← the contract shown in Demo 1
/extensions/
  media-mail-banner/      ← one minimal theme app extension (see §4)
app/
  shopify.server.ts       ← client-credentials token handling + in-memory token cache
  routes/
    app._index.tsx        ← the one UI route (registry table, see §5)
    webhooks.tsx          ← the one webhook handler shown in Demo 1
  registry.server.ts      ← tiny registry store (SQLite or even JSON is fine)
```

Requirements:
- `shopify.app.toml` must be **readable top-to-bottom in under a minute**: name, the level-1 scopes, the webhook subscriptions, app URL. No noise. This file is the star of Demo 1.
- Secrets held as an array `[current, previous]` in config from day one — minting uses index 0, webhook verification tries all. (Mentioned on the rotation slide; nice to point at in code.)
- Token cache: in-memory with TTL is enough for the demo — but make it a named module (`tokenCache`) so it's pointable on the architecture slide.

## 3. Scopes (the "level 1" draft, made concrete)

Required (small, read-mostly, no protected customer data):
- `read_products` — innocuous, guarantees a visible scope list on the consent screen
- `read_themes` — powers the "theme + version" registry column

Plus one **optional scope** left undeclared at install time, e.g. `read_locales` — requested at runtime during Demo 6.

Keep one more required scope (e.g. `read_content`) prepared in a local branch: adding it and deploying is the re-approval moment in Demo 6.

## 4. The extension

One **theme app extension**: a trivial storefront banner block ("Media Mail available" — echoes the G1 example). Requirements:
- Small enough to diff on one screen (Demo 4 shows the version diff).
- Two prepared versions of its copy/color so Demo 3–4 have a visible change to deploy and roll back.
- No Function needed unless time allows — the theme app extension is enough to demonstrate `/extensions`, `shopify app deploy`, versioning, and rollback.

## 5. The UI route (mini registry)

`app._index.tsx` renders one Polaris table — the registry, exactly like slide D3:
- Columns: store ID, domain, status (live/password), plan, contact email, theme + version, "data connection" (hard-coded internal status).
- Rows appear via **self-registration on install** — the install handler writes the row. This is the "self-registration moment" in Demo 5.
- A row's domain updates live via the `shop/update` webhook; uninstalling removes/closes the row (`app/uninstalled`). If time allows in Demo 5, rename a dev store's domain to show it.

## 6. Webhooks

Declared in the TOML (not per-store): `shop/update`, `app/uninstalled`.
Handler must: verify HMAC (against the secrets array), return 200 fast, log the delivery, update the registry. A visible log tail (terminal or route) makes the webhook flow demonstrable.

## 7. Demo-by-demo checklist

| Demo | Needs ready |
|---|---|
| 1 — code | Repo open in editor; TOML, `webhooks.tsx`, `/extensions` boundary bookmarked |
| 2 — Dev Dashboard | Org access for the audience; credentials page; ≥2 dev stores |
| 3 — CLI deploy | Extension copy change staged; clean main checkout; `shopify app deploy` + `versions list` rehearsed |
| 4 — releases/rollback | ≥3 versions in history incl. one scope-changing version (to show the flag); older version releasable |
| 5 — install link | One dev store with the app NOT installed; a non-owner store user with app permissions to do the approval; registry table visible on second screen |
| 6 — permissions | Branch with the extra required scope ready to deploy; optional-scope request button in the UI |
| 7 (optional) — Claude | Shopify connector authorized against a dev store only; fallback: Claude Code + Dev MCP with a schema question prepared |

## 8. Pre-session prep (once)

1. Create both app records in the Dev Dashboard; grant team access.
2. Scaffold from the template, add the extension, wire the two webhooks, build the registry route.
3. Deploy 3+ app versions so Demo 4 has history (v1 baseline, v2 extension change, v3 scope change — leave v3 unreleased).
4. Install on 2 of 3 dev stores (the third stays clean for Demo 5).
5. Rehearse secret rotation once on `platform-demo-staging`.
6. Verify the tunnel situation on the presenting machine (Jamf ticket) — if unresolved, present `app dev` from a personal/unmanaged machine or pre-record that 30 seconds.

## 9. Explicitly out of scope

- Any production store, real customer data, or protected-customer-data scopes.
- Functions, admin blocks, bulk operations (slides cover them; the demo doesn't).
- Real NetSuite/fansifter integrations — the "data connection" column is a hard-coded internal status.
