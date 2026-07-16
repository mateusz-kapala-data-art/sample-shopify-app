# Addendum — UI & Route Structure ("Platform App (Demo)")

Extends `spec.md`. Goal: the app on the second screen looks like a thin slice of the real Sony Music Platform App — professional, quiet, Polaris-native — and its navigation mirrors the presentation, one route per on-stage feature, so switching from a slide to the app never means hunting.

## A1. Look & feel principles

- **Polaris, unmodified.** Polaris components with default tokens — no custom CSS beyond layout. The professionalism comes from restraint: Page + Layout + Card, tables for tabular data, `Badge` for statuses, empty states where a demo hasn't produced data yet.
- **Embedded in Admin** via App Bridge — title bar, nav menu, and toasts come from Admin, matching what merchants see. Nothing floats outside the Admin frame.
- **Naming discipline.** App name renders as "Platform App" everywhere (the `(Demo)` suffix lives only in the Dev Dashboard record). Route titles use the same nouns as the slides: Registry, Versions, Webhooks, Permissions.
- **No lorem, no placeholders on stage.** Every visible row/value is real (from dev stores) or clearly marked `internal · hard-coded` like the data-connection column.
- **Empty and error states are designed, not accidental** — each route below defines what it shows before its demo has run.

## A2. Route map — one route per demo feature

Navigation (App Bridge nav menu, in presentation order):

```
app/routes/
  app._index.tsx            Registry            (Demo 5 · deck D4)
  app.versions.tsx          Versions & releases (Demos 3–4 · deck F/G)
  app.webhooks.tsx          Webhook log         (Demo 1/5 · deck D3)
  app.permissions.tsx       Permissions         (Demo 6 · deck I2/I3)
  app.about.tsx             About this demo     (session-only, optional)
  webhooks.tsx              (handler, unchanged — no UI)
```

Rules:
- Every route is **self-sufficient**: loads its own data in the loader, renders in <1s, works if opened cold mid-presentation.
- Every route header carries a subdued `Text` line naming its deck anchor, e.g. "Shown with Section D · slide 15" — so the audience can reconnect app ↔ deck at any point.
- Nav order = presentation order. Nothing else in the nav.

## A3. Per-route spec

### `app._index.tsx` — Registry (home)
Unchanged from §5 of the base spec, plus:
- Table with `Badge` for status (`live` = success, `password` = attention) and data connection (`internal` tone).
- Empty state (before Demo 5 installs): "No stores registered yet. Stores self-register on install." — this is itself a talking point.
- A subdued footer line: "Rows are written by the install handler and updated by shop/update — nothing here is entered by hand."

### `app.versions.tsx` — Versions & releases
Read-only mirror of Demo 3–4 so the audience sees version history *inside* the app, not just the CLI:
- Renders the real `shopify app versions list` output captured at deploy time.
- Table: version, created, status, message.
- Banner (info tone): "Deploys and rollbacks happen in the CLI — this page only observes."

### `app.webhooks.tsx` — Webhook log
The "visible log tail" from §6, promoted to a route:
- Reverse-chron list: topic `Badge`, shop domain, HMAC verdict, timestamp, applied state.
- Log store: the `WebhookEvent` table — last 50, no retention beyond the session.
- Empty state: "No deliveries yet. Trigger one: rename a dev store."

### `app.permissions.tsx` — Permissions (Demo 6 stage)
- Card 1 — **Granted scopes**: current scope list read live from `currentAppInstallation`, rendered as badges. This visibly changes after the re-approval moment.
- Card 2 — **Optional scope**: shows `read_locales` state (not granted → granted) with the request `Button` that triggers the runtime grant flow. Success → toast + badge flips.
- Card 3 — **App-level grants** (static, mirrors slide I2): two rows — protected customer data: "not requested — out of scope for this demo"; restricted scopes: "none". Keeps the two-level story visible in the product.

### `app.about.tsx` — About (optional, cuttable)
One card: what this app is, repo URL, "everything here transfers 1:1 to the Platform App". Only if time allows; not in Demo checklist.

## A4. Presentation alignment mechanics

- **Second-screen discipline:** app stays open on the demo machine's second display, sized to the projector. Each demo starts by clicking the matching nav item — never by typing a URL.
- **Deck ↔ app cross-references:** the deck's demo slides name the route ("switch to *Versions*"); the routes name the slide (header subline). Update both if either renumbers.
- **State pre-seeding:** before the session, every route must be non-empty except Registry's third store (Demo 5 needs the empty→filled moment) and the optional scope (Demo 6 needs not-granted).

## A5. Build additions to §8 (pre-session prep)

7. Build the three new routes + nav; verify each cold-loads under 1s on the venue network.
8. Seed webhook log with ≥5 real deliveries (rename a dev store twice, reinstall once).
9. Screenshot each route in its final state as a fallback deck appendix in case the venue network dies.

## A6. Still out of scope

Everything in §9, plus: theming/custom CSS, dark mode, mobile layouts, auth roles inside the app UI (Admin handles access), persistence beyond the session.
