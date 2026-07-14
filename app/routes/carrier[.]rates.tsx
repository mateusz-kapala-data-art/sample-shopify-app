// [SHOWCASE] SHOW-07 — PUBLIC carrier-rate callback. Intentionally open with no
// session check: Shopify's checkout servers call this URL and cannot present a
// merchant session token, so no admin-session check or webhook HMAC check runs
// here — this route lives outside the app.* protected tree, at the same public
// tier as app/routes/webhooks.tsx (see that file for the tier precedent; do NOT
// copy its HMAC-verification block — carrier-callback origin verification is
// genuinely unresolved in Shopify's own docs, RESEARCH.md Pitfall 6). The
// response below is deterministic, store-agnostic, and mutates no state, so
// serving it without airtight verification is low risk — never claim on a slide
// that this callback is cryptographically verified.
import type { ActionFunctionArgs } from "react-router";

export const action = async ({ request }: ActionFunctionArgs) => {
  // rate.origin / rate.destination / rate.items / rate.currency are ignored —
  // the response is identical regardless of input, per RESEARCH.md Code Examples.
  await request.json();

  return Response.json({
    rates: [
      {
        service_name: "Media Mail (Sony demo)",
        service_code: "SONY_DEMO_MEDIA_MAIL",
        total_price: "392", // cents, per shopify.dev rate-response contract
        currency: "USD",
        description: "Sony Platform demo carrier — flat rate",
      },
    ],
  });
};
