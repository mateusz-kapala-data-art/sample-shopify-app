// [DEMO 1b] Live extensions demo — reachable from the nav. Activate the release-pixel
// web pixel on this store, and fire the "Release went live" Flow trigger. Both call the
// Admin GraphQL API from the action, dispatched by an `intent` form field.
import type { ActionFunctionArgs, HeadersFunction } from "react-router";
import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DeckAnchor } from "../lib/presentation";

// Activate the pixel on this store. Select only userErrors — selecting the returned
// webPixel would also require read_pixels, which the app doesn't request.
const ACTIVATE_PIXEL = `#graphql
  mutation ActivateReleasePixel {
    webPixelCreate(webPixel: { settings: "{}" }) {
      userErrors { field message }
    }
  }
`;

// handle + field keys must match extensions/flow-release-live/shopify.extension.toml.
const FLOW_TRIGGER_RECEIVE = `#graphql
  mutation FlowTriggerReceive($handle: String, $payload: JSON) {
    flowTriggerReceive(handle: $handle, payload: $payload) {
      userErrors { field message }
    }
  }
`;

// Shared: fail on top-level GraphQL errors or mutation userErrors, else ok.
function resultFromBody(body: any, mutationName: string, intent: string) {
  if (body?.errors?.length) {
    return { ok: false, intent, error: body.errors.map((e: any) => e.message).join("; ") };
  }
  const userErrors = body?.data?.[mutationName]?.userErrors ?? [];
  if (userErrors.length > 0) {
    return { ok: false, intent, error: userErrors.map((e: any) => e.message).join("; ") };
  }
  return { ok: true, intent };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  try {
    if (intent === "activate-pixel") {
      const res = await admin.graphql(ACTIVATE_PIXEL);
      return resultFromBody(await res.json(), "webPixelCreate", intent);
    }

    if (intent === "fire-trigger") {
      const res = await admin.graphql(FLOW_TRIGGER_RECEIVE, {
        variables: {
          handle: "release-went-live",
          // Keys must match the trigger's field keys verbatim (alphabetic + spaces).
          payload: {
            "Release title": "Midnight Static — LP",
            "Catalog number": "SME-4417",
            "Street date": "2026-07-24",
          },
        },
      });
      return resultFromBody(await res.json(), "flowTriggerReceive", intent);
    }

    return { ok: false, intent: "unknown", error: "Unknown action." };
  } catch (err) {
    if (err instanceof Response) throw err; // React Router control flow (re-auth)
    return { ok: false, intent, error: "Request failed (network or server error)." };
  }
};

// One button + its own fetcher, toast on its own result. Matches the per-control
// fetcher convention in app.registry.$shop.tsx. On success the button reflects the
// new state (label swap + success badge); oneShot also disables it (re-activating a
// pixel errors with "already taken").
function DemoAction({
  intent,
  label,
  doneLabel,
  doneBadge,
  okToast,
  oneShot = false,
  children,
}: {
  intent: string;
  label: string;
  doneLabel: string;
  doneBadge: string;
  okToast: string;
  oneShot?: boolean;
  children: React.ReactNode;
}) {
  const shopify = useAppBridge();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.data as { ok?: boolean; intent?: string; error?: string } | undefined;
  const mine = result?.intent === intent;
  const done = mine && result?.ok === true;

  useEffect(() => {
    if (!mine) return;
    if (result?.ok) shopify.toast.show(okToast);
    else if (result?.error) shopify.toast.show(result.error, { isError: true });
  }, [result, mine, okToast, shopify]);

  return (
    <s-stack direction="block" gap="base">
      <s-text>{children}</s-text>
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-button
          variant={done ? "secondary" : "primary"}
          onClick={() => fetcher.submit({ intent }, { method: "post" })}
          {...(busy ? { loading: true } : {})}
          {...(done && oneShot ? { disabled: true } : {})}
        >
          {done ? doneLabel : label}
        </s-button>
        {done && <s-badge tone="success">{doneBadge}</s-badge>}
      </s-stack>
      {mine && result?.error && <s-text tone="critical">{result.error}</s-text>}
    </s-stack>
  );
}

export default function LiveExtensions() {
  return (
    <s-page heading="Live extensions">
      <DeckAnchor>Demo 1b · web pixel + Flow trigger · range tour</DeckAnchor>

      <s-section heading="Web pixel · release-pixel">
        <DemoAction
          intent="activate-pixel"
          label="Activate pixel on this store"
          doneLabel="Pixel activated"
          doneBadge="Active"
          oneShot
          okToast="release-pixel activated — open a product, watch the storefront console"
        >
          Activates the release-pixel web pixel on this store (webPixelCreate). Once active,
          product views and checkout completion log to the storefront browser console.
        </DemoAction>
      </s-section>

      <s-section heading="Flow trigger · Release went live">
        <DemoAction
          intent="fire-trigger"
          label="Fire ‘Release went live’"
          doneLabel="Fire again"
          doneBadge="Fired"
          okToast="Trigger fired — check Flow run log"
        >
          POSTs the “Release went live” Flow trigger for Midnight Static — LP (SME-4417) via
          flowTriggerReceive.
        </DemoAction>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
