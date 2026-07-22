// [DEMO 1b] Flow trigger demo rig — a hidden route (not in the nav) that fires
// the "Release went live" Flow trigger with a hard-coded release payload via the
// Admin GraphQL flowTriggerReceive mutation. Shown with the range tour.
import type { ActionFunctionArgs, HeadersFunction } from "react-router";
import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DeckAnchor } from "../lib/presentation";

// handle + field keys must match extensions/flow-release-live/shopify.extension.toml.
const FLOW_TRIGGER_RECEIVE = `#graphql
  mutation FlowTriggerReceive($handle: String, $payload: JSON) {
    flowTriggerReceive(handle: $handle, payload: $payload) {
      userErrors { field message }
    }
  }
`;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  try {
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
    const body: any = await res.json();
    // Top-level GraphQL errors (throttling, bad field) never appear in userErrors —
    // without this check an empty userErrors array would read as a false success.
    if (body?.errors?.length) {
      return { ok: false, error: body.errors.map((e: any) => e.message).join("; ") };
    }
    const userErrors = body?.data?.flowTriggerReceive?.userErrors ?? [];
    if (userErrors.length > 0) {
      return { ok: false, error: userErrors.map((e: any) => e.message).join("; ") };
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof Response) throw err; // React Router control flow (re-auth)
    return { ok: false, error: "Firing the trigger failed (network or server error)." };
  }
};

export default function FlowDemo() {
  const shopify = useAppBridge();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.data as { ok?: boolean; error?: string } | undefined;

  // shopify.toast.show is imperative, so react to the action result here.
  useEffect(() => {
    if (!result) return;
    if (result.ok) shopify.toast.show("Trigger fired — check Flow run log");
    else if (result.error) shopify.toast.show(result.error, { isError: true });
  }, [result, shopify]);

  return (
    <s-page heading="Fire Flow trigger">
      <DeckAnchor>Flow trigger · shown with the range tour · Demo 1b</DeckAnchor>
      <s-section heading="Release went live">
        <s-stack direction="block" gap="base">
          <s-text>
            POSTs the “Release went live” Flow trigger for Midnight Static — LP
            (SME-4417) via flowTriggerReceive.
          </s-text>
          <s-button
            variant="primary"
            onClick={() => fetcher.submit({}, { method: "post" })}
            {...(busy ? { loading: true } : {})}
          >
            Fire ‘Release went live’
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
