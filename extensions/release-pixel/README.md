# release-pixel

Web pixel for **Demo 1b**. One `register()` subscribing to two standard events,
logging small flat objects to the browser console:

- `product_viewed` → `[release-pixel] product_viewed { title, price }`
- `checkout_completed` → `[release-pixel] checkout_completed { orderId, totalPrice }`

The talking point: the same pixel keeps firing from the storefront **into
checkout** (`checkout_completed`), in a sandbox, with no theme edits.

## Activation (once per dev store, in prep)

Pixels must be activated per store. `shopify app deploy` publishes the
extension; then create the web pixel record once via the Admin GraphQL API
(GraphiQL or the app's API client). Requires the `write_pixels` scope
(declared in `shopify.app.toml`):

```graphql
mutation ActivateReleasePixel {
  webPixelCreate(webPixel: { settings: "{}" }) {
    userErrors { field message }
  }
}
```

Settings are `{}` — this pixel needs no configuration. You can also toggle the
pixel from the app's pixel settings page after deploy.

## Demo check

- Open a product on the dev storefront → `product_viewed` in the console.
- Complete a test checkout → `checkout_completed` in the console.
