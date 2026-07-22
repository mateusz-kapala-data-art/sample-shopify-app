# flow-release-live

Shopify Flow **trigger** for Demo 1b: "Release went live". Config-only — no
source bundle. The trigger is fired server-side from `/app/flow-demo`
(`app/routes/app.flow-demo.tsx`) via the `flowTriggerReceive` mutation.

Trigger handle: `release-went-live`. Payload fields (keys must match the
`flowTriggerReceive` payload verbatim):

- `release_title` (string)
- `catalog_number` (string)
- `street_date` (string, ISO date)

## Workflow prep (once per dev store, in prep)

The trigger only appears in Flow **after `shopify app deploy` + app install**
on that store (Flow triggers require a Plus or dev-Plus store).

1. Flow → **Create workflow** → trigger **"Release went live"**.
2. Add an action — **Add product tags** (`went-live`) or **Send internal email**.
3. **Save** and **turn on**.

## Demo check

Click **"Fire 'Release went live'"** on `/app/flow-demo` → the Flow run log on
the dev store shows a run within seconds → tag/email visible.

> Field-key note: if `shopify app deploy` rejects the snake_case keys above,
> switch all three to sentence case (`Release title`, `Catalog number`,
> `Street date`) here **and** in the route payload — they must stay identical.
