// [DEMO 1] media-mail-discount-settings — the Function's merchant UI (addendum §4b).
//
// A fourth surface, and a fourth kind of "where does this code run": this is an
// ADMIN UI extension. Shopify renders it inside the discount details page and
// hosts it — our server is not involved, and neither is our app's Polaris UI.
// Shopify also owns the discount itself (name, dates, eligibility, save button);
// all we contribute is the one field our Function actually reads.
//
// The saved value lands in the $app/function-configuration metafield on the
// discount, which extensions/media-mail-discount reads via discount.metafield.
// That is the whole point on stage: the Function is compiled Wasm, but its
// behaviour changes from this form — no redeploy, no new app version.
import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState } from "preact/hooks";

const METAFIELD_KEY = "function-configuration"; // must match the Function's input query
const DEFAULT_AMOUNT = "5.00"; // must match DEFAULT_AMOUNT in the Function

export default async () => {
  render(<App />, document.body);
};

function App() {
  const { applyMetafieldChange, data, discounts, i18n } = shopify;

  const savedAmount = readAmount(data);
  const [amount, setAmount] = useState(savedAmount);

  // Our Function only ever discounts shipping, so the discount must carry the
  // Shipping class or cartDeliveryOptionsDiscountsGenerateRun returns nothing.
  // Rather than offer a checkbox that can only be wrong, enforce it on save.
  const hasShippingClass = (discounts?.discountClasses?.value ?? []).includes(
    "shipping",
  );

  async function save() {
    if (!hasShippingClass) {
      await discounts?.updateDiscountClasses?.(["shipping"]);
    }
    await applyMetafieldChange({
      type: "updateMetafield",
      namespace: "$app",
      key: METAFIELD_KEY,
      value: JSON.stringify({ amount }),
      valueType: "json",
    });
  }

  return (
    <s-function-settings
      onSubmit={(event) => event.waitUntil?.(save())}
      onReset={() => setAmount(savedAmount)}
    >
      <s-section>
        <s-stack gap="base">
          <s-text>{i18n.translate("explanation")}</s-text>
          <s-number-field
            label={i18n.translate("amountLabel")}
            name="amount"
            value={amount}
            defaultValue={savedAmount}
            min={0}
            step={0.01}
            prefix="$"
            onChange={(event) => setAmount(event.currentTarget.value)}
          />
        </s-stack>
      </s-section>
    </s-function-settings>
  );
}

// data.metafields is what Shopify already saved on this discount; absent or
// malformed config falls back to the same default the Function uses.
function readAmount(data) {
  const raw = data?.metafields?.find((m) => m.key === METAFIELD_KEY)?.value;
  try {
    const amount = JSON.parse(raw || "{}").amount;
    return typeof amount === "string" && amount.trim() !== ""
      ? amount
      : DEFAULT_AMOUNT;
  } catch {
    return DEFAULT_AMOUNT;
  }
}
