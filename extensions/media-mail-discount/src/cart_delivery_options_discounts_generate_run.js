// [DEMO 1] media-mail-discount — the Function proof (spec addendum §4b).
//
// The pointable anchor for the "Functions are synchronous logic INSIDE Shopify"
// slide. This is not our server: it compiles to WebAssembly, ships with the app
// version, and Shopify runs it inline while pricing the cart — no network, no
// database, ~5ms budget. Pure input -> output.
//
// Input comes from cart_delivery_options_discounts_generate_run.graphql; output
// is a plain object. That is the whole contract. Contrast with
// app/routes/webhooks.tsx (our server, async, runs after the fact) — this runs
// before checkout can render a shipping price.
//
// Rule: flat shipping discount when EVERY line in the cart is tagged
// `media-mail`. The amount is merchant-configurable on the discount page (see
// extensions/media-mail-discount-settings) and arrives via discount.metafield.
import {
  DeliveryDiscountSelectionStrategy,
  DiscountClass,
} from "../generated/api";

/**
 * @typedef {import("../generated/api").DeliveryInput} RunInput
 * @typedef {import("../generated/api").CartDeliveryOptionsDiscountsGenerateRunResult} DeliveryResult
 */

const DEFAULT_AMOUNT = "5.00"; // used until a merchant saves a setting

/** @type {DeliveryResult} */
const NO_DISCOUNT = { operations: [] };

/**
 * @param {RunInput} input
 * @returns {DeliveryResult}
 */
export function cartDeliveryOptionsDiscountsGenerateRun(input) {
  // A discount can be configured to combine as Product/Order/Shipping. If the
  // merchant did not give this one the Shipping class, we must not touch
  // delivery — Shopify asks every class, we answer only for ours.
  if (!input.discount.discountClasses.includes(DiscountClass.Shipping)) {
    return NO_DISCOUNT;
  }

  const lines = input.cart.lines ?? [];
  const deliveryGroups = input.cart.deliveryGroups ?? [];

  // An empty cart vacuously satisfies `every`, so check length first. A
  // CustomProduct line has no `product`, so hasAnyTag is undefined -> false:
  // one untagged item disqualifies the cart, which is the rule we want.
  const everyLineIsMediaMail =
    lines.length > 0 &&
    lines.every((line) => line.merchandise?.product?.hasAnyTag === true);

  if (!everyLineIsMediaMail || deliveryGroups.length === 0) {
    return NO_DISCOUNT;
  }

  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: [
            {
              message: "Media Mail shipping",
              targets: deliveryGroups.map((group) => ({
                deliveryGroup: { id: group.id },
              })),
              value: { fixedAmount: { amount: readAmount(input.discount) } },
            },
          ],
          selectionStrategy: DeliveryDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}

/**
 * The merchant's saved setting. Absent or malformed config falls back to the
 * default rather than throwing — an unconfigured discount should quietly do
 * the ordinary thing, never break the checkout it runs inside.
 * @param {RunInput["discount"]} discount
 * @returns {string}
 */
function readAmount(discount) {
  const amount = discount.metafield?.jsonValue?.amount;
  return typeof amount === "string" && amount.trim() !== ""
    ? amount
    : DEFAULT_AMOUNT;
}
