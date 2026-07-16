// [DEMOS 3–4] [SECTION F/G] Versions & releases — a LIVE, read-only mirror of the CLI
// version history. The loader runs `shopify app versions list` at request time (see
// app/lib/appVersions.server.ts), so a `shopify app deploy` on stage appears here the
// moment the presenter opens or refreshes this route. Deploys/rollbacks still happen in
// the CLI — this page only observes them; it never mutates anything.
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DeckAnchor } from "../lib/presentation";
import { getAppVersions } from "../lib/appVersions.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { versions, source } = await getAppVersions();
  return { versions, source };
};

export default function Versions() {
  const { versions, source } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const refreshing = revalidator.state !== "idle";

  return (
    <s-page heading="Versions & releases">
      <DeckAnchor>Versions & releases · Demos 3–4 · deck section F/G</DeckAnchor>

      {/* Re-runs the loader → re-runs the CLI, so a just-deployed version shows up live. */}
      <s-button
        slot="primary-action"
        onClick={() => revalidator.revalidate()}
        {...(refreshing ? { loading: true } : {})}
      >
        Refresh from CLI
      </s-button>

      <s-banner tone="info">
        <s-paragraph>
          Deploys and rollbacks happen in the CLI — this page only observes. Deploy a new
          version, then hit “Refresh from CLI” to watch it appear.
        </s-paragraph>
      </s-banner>

      <s-section heading="App versions">
        <s-stack direction="block" gap="base">
          {/* Honest source indicator: live from the CLI, or the captured fallback snapshot. */}
          {source === "live" ? (
            <s-badge tone="success">live · shopify app versions list</s-badge>
          ) : (
            <s-badge tone="neutral">
              captured snapshot — CLI not reachable from the server
            </s-badge>
          )}

          {versions.length === 0 ? (
            <s-text color="subdued">No versions yet — run `shopify app deploy`.</s-text>
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
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
