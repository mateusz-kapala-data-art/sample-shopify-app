# release-pixel

Web pixel for **Demo 1b**. One `register()` subscribing to two standard events,
logging small flat objects to the browser console:

- `product_viewed` → `[release-pixel] product_viewed { title, price }`
- `checkout_completed` → `[release-pixel] checkout_completed { orderId, totalPrice }`

The talking point: the same pixel keeps firing from the storefront **into
checkout** (`checkout_completed`), in a sandbox, with no theme edits.

## Activation (once per dev store, in prep)

Pixels must be activated per store. `shopify app deploy` publishes the
extension; then activate the pixel on the store. Simplest: open the app's
**Live extensions** page (`/app/flow-demo`) and click **Activate pixel on this
store** — it runs `webPixelCreate` for you. Requires the `write_pixels` scope
(declared in `shopify.app.toml`).

Equivalent Admin GraphQL, if you prefer GraphiQL:

```graphql
mutation ActivateReleasePixel {
  webPixelCreate(webPixel: { settings: "{}" }) {
    userErrors { field message }
  }
}
```

Settings are `{}` — this pixel needs no configuration.

## Demo check

- Open a product on the dev storefront → `product_viewed` in the console.
- Complete a test checkout → `checkout_completed` in the console.
