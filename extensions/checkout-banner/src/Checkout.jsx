// [DEMO 1] checkout-banner — the checkout sandbox proof (spec addendum §4a).
// Same repo, same `shopify app deploy`, same app version as the theme extension
// and the Function — but this code does NOT run on our server. It runs inside
// Shopify's checkout sandbox. Since checkout.liquid was retired, a checkout UI
// extension is the only supported way into Plus checkout.
//
// Contrast with extensions/platform-badge (storefront, merchant-placed via the
// theme editor). This one is placed by the merchant in checkout customization.
//
// Deliberately static: no network calls, no settings, no capabilities beyond
// defaults. A proof of range, not a feature.
import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  return (
    <s-banner heading="Media Mail">
      <s-text>{shopify.i18n.translate("mediaMailNotice")}</s-text>
    </s-banner>
  );
}
