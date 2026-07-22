import { register } from "@shopify/web-pixels-extension";

// [DEMO 1b] Pixel survives from storefront into checkout — one register(),
// two events, flat payloads that read cleanly in devtools on stage.
register(({ analytics }) => {
  analytics.subscribe("product_viewed", (event) => {
    const variant = event.data.productVariant;
    console.log("[release-pixel] product_viewed", {
      title: variant.title,
      price: variant.price.amount,
    });
  });

  analytics.subscribe("checkout_completed", (event) => {
    const checkout = event.data.checkout;
    console.log("[release-pixel] checkout_completed", {
      orderId: checkout.order?.id,
      totalPrice: checkout.totalPrice?.amount,
    });
  });
});
