// [SHOWCASE] SHOW-07 — "Enable shipping module": scope-gated carrierServiceCreate.
// The console requests write_shipping at runtime (card.scope drives
// app/lib/scopesClient.ts's ensureScope flow — same pattern as
// app/routes/app.registry.tsx's enableShippingModule, lines 247-280) before this
// run() ever executes; the mutation itself registers a carrier service whose
// callback points at our own PUBLIC /carrier.rates route
// (app/routes/carrier[.]rates.tsx). callbackUrl is built from the trusted
// SHOPIFY_APP_URL env var, never from request input (T-05.07-03).
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ActionCard, RunFn } from "./types";

export const ENABLE_SHIPPING_MUTATION = `#graphql
  mutation enableSonyPlatformShipping($input: DeliveryCarrierServiceCreateInput!) {
    carrierServiceCreate(input: $input) {
      carrierService {
        id
        name
        active
        callbackUrl
      }
      userErrors {
        field
        message
      }
    }
  }`;

export const card: ActionCard = {
  id: "enable-shipping",
  category: "Modules (inbound/outbound)",
  title: "Enable shipping module",
  description:
    "Registers a carrier service pointing at our own /carrier.rates callback.",
  requestKindLabel: "GraphQL mutation (carrierServiceCreate)",
  order: 1,
  preview: ENABLE_SHIPPING_MUTATION,
  scope: "write_shipping",
};

export const run: RunFn = async (admin: AdminApiContext, _shop, _form) => {
  // Trusted env, not request input — the whole point of this callback URL is
  // that it is our own, fixed, public route (Pitfall 7 / T-05.07-03).
  // Fail loudly if it is unset: a `?? ""` fallback would register the relative
  // string "/carrier.rates", which Shopify rejects as an opaque userError far from
  // the real cause (missing env), indistinguishable from a Shopify-side failure.
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (!appUrl) {
    return {
      error: "SHOPIFY_APP_URL is not set — cannot build the carrier callback URL.",
    };
  }
  const callbackUrl = `${appUrl.replace(/\/$/, "")}/carrier.rates`;

  const response = await admin.graphql(ENABLE_SHIPPING_MUTATION, {
    variables: {
      input: {
        name: "Sony Platform Demo Shipping",
        callbackUrl,
        active: true,
      },
    },
  });
  const body: any = await response.json();

  // Includes the non-dev-store plan-eligibility userError flagged in
  // RESEARCH.md Pitfall 7 — surfaced to the console, never thrown.
  const userErrors = body?.data?.carrierServiceCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    return {
      data: body.data,
      extensions: body.extensions,
      error: userErrors.map((e: { message: string }) => e.message).join("; "),
    };
  }

  return { data: body.data, extensions: body.extensions };
};
