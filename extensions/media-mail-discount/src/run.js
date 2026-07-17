// [DEMO 1] media-mail-discount — the Function proof (spec addendum §4b).
//
// This is the pointable anchor for the "Functions are synchronous logic INSIDE
// Shopify" slide. It is not our server: this file compiles to WebAssembly, ships
// with the app version, and Shopify runs it inline while pricing the cart —
// no network, no database, ~5ms budget. Pure input -> output.
//
// The input comes from src/run.graphql; the output is a plain object. That is
// the entire contract. Contrast with app/routes/webhooks.tsx (our server, async,
// runs after the fact) — this runs synchronously, before checkout renders a price.
//
// Rule: flat shipping discount when EVERY line in the cart is tagged `media-mail`.

/** @typedef {import("../generated/api").RunInput} RunInput */
/** @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult */

const MEDIA_MAIL_TAG = "media-mail"; // must match the tag in src/run.graphql
const FLAT_DISCOUNT_AMOUNT = "5.00"; // Decimal, in the cart's currency

/** @type {FunctionRunResult} */
const NO_DISCOUNT = { discounts: [] };

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const lines = input?.cart?.lines ?? [];
  const deliveryGroups = input?.cart?.deliveryGroups ?? [];

  // An empty cart vacuously satisfies `every`, so test length first. A
  // CustomProduct line has no `product`, so hasAnyTag is undefined -> false:
  // one untagged item disqualifies the whole cart, which is the rule we want.
  const everyLineIsMediaMail =
    lines.length > 0 &&
    lines.every((line) => line.merchandise?.product?.hasAnyTag === true);

  if (!everyLineIsMediaMail || deliveryGroups.length === 0) {
    return NO_DISCOUNT;
  }

  return {
    discounts: [
      {
        message: `${MEDIA_MAIL_TAG} shipping`,
        targets: deliveryGroups.map((group) => ({
          deliveryGroup: { id: group.id },
        })),
        value: { fixedAmount: { amount: FLAT_DISCOUNT_AMOUNT } },
      },
    ],
  };
}
