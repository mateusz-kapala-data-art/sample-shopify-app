import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      {/* [ADDENDUM A2] Nav = presentation order, one item per on-stage demo. Nothing else. */}
      <s-app-nav>
        <s-link href="/app">Registry</s-link>
        <s-link href="/app/flow-demo">Live extensions</s-link>
        <s-link href="/app/versions">Versions</s-link>
        <s-link href="/app/webhooks">Webhooks</s-link>
        <s-link href="/app/permissions">Permissions</s-link>
        <s-link href="/app/about">About</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
