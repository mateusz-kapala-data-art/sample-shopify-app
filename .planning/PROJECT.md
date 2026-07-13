# Sony Platform App (Demo)

## What This Is

A Shopify embedded app built as a **live-presentation teaching artifact**. It demonstrates a "platform app" pattern — a single custom app that self-registers stores into a central registry, verifies webhooks with rotatable secrets, mints admin tokens via client credentials, and manages per-store modules at runtime. It is run on stage by a presenter to anchor the claims of an accompanying deck ("Presentation Spec v2") in honest, working code, and to power six live demos (plus one optional Claude-connector demo).

The base is the standard Shopify React Router template (TypeScript, Prisma/SQLite, Polaris, App Bridge, OAuth + webhooks) — the plumbing is real; the platform-app product on top of it is what this project builds.

## Core Value

Every crucial claim in the deck has a visible, working anchor in code or on screen, and the six live demos run reliably on stage. Demo-first, not production-first: honest patterns, no fakes, optimized for visibility (small files, loud waypoint comments, obvious names).

## Requirements

### Validated

<!-- Inferred from existing Shopify React Router scaffold — shipped and relied upon. -->

- ✓ Shopify OAuth login + embedded admin authentication (`authenticate.admin`) — existing
- ✓ Prisma session storage (SQLite) — existing
- ✓ Embedded admin UI with Polaris web components + App Bridge — existing
- ✓ Webhook handler scaffold with HMAC verification (`authenticate.webhook`) — existing
- ✓ File-based routing, SSR/streaming via React Router v7 — existing

### Active

<!-- v1 demo scope. Hypotheses until the demos run clean on stage. -->

- [ ] Self-registration on install: afterAuth upserts a Store registry row and triggers an initial sync (no manual entry)
- [ ] Registry data model: `Store` (columns mirror the Registry Map slide) + `WebhookEvent` (dedupe by Shopify webhook id)
- [ ] Webhook pipeline: HMAC verify → idempotent insert → return 200 → interval worker applies events to the registry
- [ ] `shop/update` handler updates domain/status; `app/uninstalled` sets `uninstalledAt` and wipes cached tokens
- [ ] Multi-secret webhook verification: `SHOPIFY_CLIENT_SECRETS` as comma-separated array; mint with index 0, verify against all
- [ ] Client-credentials admin token service: `getAdminToken(shop)` → 24h token, in-memory cache with expiry, redacted logging
- [ ] Degraded mode: `invalid_client` sets a `degraded` flag surfaced as a red banner on the registry page; jobs pause
- [ ] Registry page (`app.registry.tsx`): Polaris IndexTable of stores, "Run re-sync now", per-store module toggle, degraded banner
- [ ] Runtime optional-scope request: enabling the shipping module requests `write_shipping` via App Bridge; grant→state, decline→banner
- [ ] `platform-badge` theme app extension: storefront block rendering "Connected to Sony Platform" with a `BADGE_TEXT` version constant
- [ ] `app._index.tsx` loader query character-identical to the Slide D1 query (shop id/name/contactEmail/primaryDomain/plan + themes read)
- [ ] Curated `shopify.app.toml` as a teaching artifact: `read_themes` scope, `write_shipping`/`write_themes` optional scopes, declared webhooks + compliance topics, heavy waypoint comments
- [ ] Waypoint comments throughout (`// [DEMO n]`, `// [SLIDE Xn]`) so the presenter can Cmd+P between stops
- [ ] `.env.example` complete (`SHOPIFY_API_KEY`, `SHOPIFY_CLIENT_SECRETS`, `DATABASE_URL`) so teammates can boot the sandbox

### Out of Scope

- media-mail-eligibility delivery Function — optional stretch; deferred to backlog (a misbehaving checkout Function is not worth the stage risk)
- `SIMULATE_BAD_SECRET` rehearsal env flag — deferred; degraded banner still triggers on real `invalid_client`
- Dev Dashboard store prep, git tags, pre-created app versions, tunnel/Jamf — manual ops, captured as a checklist doc (`scripts/demo-reset.md`), not build phases
- Production hardening beyond deck claims: real Redis, real queue infra, SSO on the registry page — named in the deck as later work
- Real Sony store data, the NetSuite connector, the Storefront/registry MCP servers — later work per deck §8
- Postgres migration — SQLite kept deliberately to keep the demo self-contained (comment says so in `schema.prisma`)

## Context

- **Base scaffold:** Shopify `shopify app init` React Router template, TypeScript. File paths must match what an audience sees when they scaffold their own (`shopify.app.toml`, `app/shopify.server.ts`, `app/routes/`, `/extensions`).
- **App identity:** "Sony Platform App (Demo)" in the Dev Dashboard; distribution custom, multi-store within the dev organization.
- **Queue design:** webhook queue is a DB table (`WebhookEvent`), applied by a simple dev interval worker — visible, explainable, no Redis dependency on stage.
- **Token split:** client-credentials tokens are used by the job runner only; the embedded UI keeps the template's session-token flow. This split is itself a slide.
- **Slide-code fidelity:** the audience will mentally diff the slide against the file for the registry query and the TOML — those must be character-identical to the deck.
- **Demo choreography** depends on pre-built states (git tags `demo-base`/`demo-ext-change`/`demo-scope-add`, app versions v1/v2/v3) prepared before the session — tracked in the checklist doc, out of the code roadmap.
- **Companion docs:** "Presentation Spec v2" (the deck) and `demo-app-codebase-spec.md` (the build spec this project derives from).

## Constraints

- **Timeline**: Live presentation under 2 weeks out — prioritize the demo-critical path; minimize anything not on a slide.
- **Tech stack**: Shopify React Router template (TypeScript, React 18, React Router 7, Prisma 6/SQLite, Polaris web components, App Bridge) — do not hand-roll structure; match the template so audience file paths line up.
- **API version**: Shopify `2026-07` (webhooks and Functions pin to it).
- **Operational**: Do not rotate the client secret in the week before the session (webhook HMAC signing can lag up to an hour after rotation). Never touch production stores/app records during the session.
- **Stage reliability**: Every payoff state must be pre-built (git tag, prepared store, or pre-created app version) — nothing improvised live. Screenshot fallbacks for every payoff moment.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Demo-first, not production-first | Code must be honest but optimized for on-stage visibility | — Pending |
| SQLite via Prisma (template default) | One less moving part on stage; self-contained demo | — Pending |
| Webhook queue as a DB table, not Redis | Visible and explainable on stage; no external dependency | — Pending |
| Secrets-as-array for webhook verification | Secret rotation becomes a config change, not a code change | — Pending |
| Client-credentials tokens for jobs only; UI keeps session tokens | Clean separation matches the token-table slide; tokens never in DB/logs | — Pending |
| Core demos only; defer media-mail Function + SIMULATE_BAD_SECRET | Tight timeline; a misbehaving checkout Function is a stage risk | — Pending |
| Manual ops (dashboard, tags, versions) as a checklist doc, not phases | Roadmap covers only what's built in the repo | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-13 after initialization*
