# flow-release-live

Shopify Flow **trigger** for Demo 1b: "Release went live". Config-only — no
source bundle. The trigger is fired server-side from `/app/flow-demo`
(`app/routes/app.flow-demo.tsx`) via the `flowTriggerReceive` mutation.

Trigger handle: `release-went-live`. Payload fields — Flow custom-field keys
must be **alphabetic characters and spaces only** (enforced by `shopify app
build`), and the `flowTriggerReceive` payload must use these keys verbatim:

- `Release title` (string)
- `Catalog number` (string)
- `Street date` (string, ISO date)

## Workflow prep (once per dev store, in prep)

The trigger only appears in Flow **after `shopify app deploy` + app install**
on that store (Flow triggers require a Plus or dev-Plus store).

1. Flow → **Create workflow** → trigger **"Release went live"**.
2. Add an action — **Add product tags** (`went-live`) or **Send internal email**.
3. **Save** and **turn on**.

## Demo check

Click **"Fire 'Release went live'"** on `/app/flow-demo` → the Flow run log on
the dev store shows a run within seconds → tag/email visible.

> The field keys here and the payload keys in `app/routes/app.flow-demo.tsx`
> must stay identical — the trigger only fires when they match verbatim.
