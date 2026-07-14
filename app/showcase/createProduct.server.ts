// [SHOWCASE] SHOW-04 — "Create a product": productCreate with ProductCreateInput (NOT
// the deprecated ProductInput used by app/routes/app._index.tsx's template code — see
// RESEARCH.md State of the Art). Declares scope: "write_products" so the console's
// "Request permission & run" flow fires the runtime optional-scope request when the
// current store hasn't granted it yet (spec §5f).
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ActionCard, RunFn } from "./types";

export const CREATE_PRODUCT_QUERY = `#graphql
  mutation createDemoVinyl($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product {
        id
        title
        handle
        status
        tags
      }
      userErrors {
        field
        message
      }
    }
  }`;

export const card: ActionCard = {
  id: "create-product",
  category: "Mutations",
  title: "Create a product",
  description:
    "Creates a 'Demo Vinyl — [timestamp]' product via productCreate. Requests write_products at runtime if the store hasn't granted it.",
  requestKindLabel: "GraphQL mutation",
  order: 2,
  preview: CREATE_PRODUCT_QUERY,
  scope: "write_products",
};

export const run: RunFn = async (admin: AdminApiContext, _shop, _form) => {
  const response = await admin.graphql(CREATE_PRODUCT_QUERY, {
    variables: {
      product: {
        title: `Demo Vinyl — ${new Date().toISOString()}`,
        status: "ACTIVE",
      },
    },
  });
  const body: any = await response.json();

  const userErrors = body?.data?.productCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    return {
      data: body.data,
      extensions: body.extensions,
      error: userErrors
        .map((e: { field?: string[]; message: string }) => e.message)
        .join("; "),
    };
  }

  return { data: body.data, extensions: body.extensions };
};
