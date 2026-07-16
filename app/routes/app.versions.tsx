// [DEMOS 3–4] [SECTION F/G] Versions & releases — a read-only mirror of the CLI
// version history. Deploys and rollbacks happen in `shopify app versions` /
// `shopify app deploy`; this page only observes the REAL captured output
// (app/data/app-versions.json via app/lib/appVersions.ts — regenerate before the
// session), so nothing here reaches out to a live API or mutates anything.
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DeckAnchor } from "../lib/presentation";
import { APP_VERSIONS } from "../lib/appVersions";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Auth-gate the page like every admin route; the data itself is the static,
  // captured version list (no live versions API call on stage).
  await authenticate.admin(request);
  return { versions: APP_VERSIONS };
};

export default function Versions() {
  const { versions } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Versions & releases">
      <DeckAnchor>Versions & releases · Demos 3–4 · deck section F/G</DeckAnchor>

      <s-banner tone="info">
        <s-paragraph>
          Deploys and rollbacks happen in the CLI — this page only observes.
        </s-paragraph>
      </s-banner>

      <s-section heading="App versions">
        {versions.length === 0 ? (
          <s-text color="subdued">No versions captured yet.</s-text>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Version</s-table-header>
              <s-table-header>Created</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Message</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {versions.map((v) => (
                <s-table-row key={v.versionTag}>
                  <s-table-cell>{v.versionTag}</s-table-cell>
                  <s-table-cell>{v.createdAt}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={v.status === "active" ? "success" : "neutral"}>
                      {v.status}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {v.message ? v.message : <s-text color="subdued">—</s-text>}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
