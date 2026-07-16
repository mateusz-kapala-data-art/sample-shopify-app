// [DEMOS 3–4] [SECTION F/G] Versions & releases — a LIVE, read-only mirror of the CLI
// version history. The loader runs `shopify app versions list` at request time (see
// app/lib/appVersions.server.ts); the page then re-runs it on a short interval, so a
// `shopify app deploy` on stage appears in the table on its own — no button to press.
// Deploys/rollbacks still happen in the CLI — this page only observes them.
import { useEffect, useRef } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DeckAnchor } from "../lib/presentation";
import { getAppVersions } from "../lib/appVersions.server";

const POLL_MS = 10_000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { versions, source } = await getAppVersions();
  return { versions, source };
};

export default function Versions() {
  const { versions, source } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  // Keep a live handle to the revalidator so the interval never captures a stale one.
  const revalidatorRef = useRef(revalidator);
  revalidatorRef.current = revalidator;

  // Auto-refresh: re-run the loader (→ re-run the CLI) on an interval while this route is
  // open, so a just-deployed version shows up automatically. Idle-guarded so polls never
  // overlap; skipped while the tab is hidden so we don't spawn the CLI needlessly.
  useEffect(() => {
    const id = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        revalidatorRef.current.state === "idle"
      ) {
        revalidatorRef.current.revalidate();
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const updating = revalidator.state !== "idle";

  return (
    <s-page heading="Versions & releases" inlineSize="large">
      <DeckAnchor>Versions & releases · Demos 3–4 · deck section F/G</DeckAnchor>

      <s-banner tone="info">
        <s-paragraph>
          Deploys and rollbacks happen in the CLI — this page only observes. Deploy a new
          version and it appears here on its own within a few seconds.
        </s-paragraph>
      </s-banner>

      <s-section heading="App versions">
        <s-stack direction="block" gap="base">
          {/* Honest source + a quiet auto-update indicator. */}
          <s-stack direction="inline" gap="base" alignItems="center">
            {source === "live" ? (
              <s-badge tone="success">live · shopify app versions list</s-badge>
            ) : (
              <s-badge tone="neutral">
                captured snapshot — CLI not reachable from the server
              </s-badge>
            )}
            <s-text color="subdued">
              {updating ? "updating…" : `auto-updating every ${POLL_MS / 1000}s`}
            </s-text>
          </s-stack>

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
