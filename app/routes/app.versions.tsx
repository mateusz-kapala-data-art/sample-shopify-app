// [DEMOS 3–4] [SECTION F/G] Versions & releases — a read-only mirror of the real
// `shopify app versions list`, captured into app/data/app-versions.json at deploy time
// (there is no live source a hosted app can read — see app/lib/appVersions.ts). The
// `npm run deploy` script refreshes this file automatically after each release, so on
// Vercel the list stays truthful; this page just renders it.
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DeckAnchor } from "../lib/presentation";
import { APP_VERSIONS } from "../lib/appVersions";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { versions: APP_VERSIONS };
};

export default function Versions() {
  const { versions } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Versions & releases" inlineSize="large">
      <DeckAnchor>Versions & releases · Demos 3–4 · deck section F/G</DeckAnchor>

      <s-banner tone="info">
        <s-paragraph>
          Deploys and rollbacks happen in the CLI — this page mirrors the real
          `shopify app versions list`, refreshed on every `npm run deploy`.
        </s-paragraph>
      </s-banner>

      <s-section heading="App versions">
        {versions.length === 0 ? (
          <s-text color="subdued">No versions captured yet — run `npm run deploy`.</s-text>
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
