// [OPTIONAL] About this demo — a quiet, session-only closing card. Cuttable if time
// runs short; no data, no live calls, just the honest framing of what this app is.
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DeckAnchor } from "../lib/presentation";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return {};
};

export default function About() {
  return (
    <s-page heading="About this demo">
      <DeckAnchor>About · session-only</DeckAnchor>

      <s-section heading="About this demo">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            This app is a thin, working slice of the Sony Music Platform App: a
            single custom app that self-registers stores into a central registry,
            mints admin tokens via client credentials, verifies webhooks with
            rotatable secrets, and requests optional scopes at runtime.
          </s-paragraph>
          <s-paragraph>Repository: internal — Sony Platform App demo</s-paragraph>
          <s-paragraph>
            Everything here transfers 1:1 to the production Platform App — same
            stack, same auth model, same repo shape.
          </s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
