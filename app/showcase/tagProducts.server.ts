// [SHOWCASE] SHOW-03 — "Tag the shop's products": additive tag mutation (tagsAdd, NOT
// productUpdate — productUpdate's tags field is a full replace and would wipe existing
// tags off the seeded demo products; tagsAdd is the purpose-built additive mutation).
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ActionCard, RunFn } from "./types";

export const TAG_PRODUCTS_QUERY = `#graphql
  mutation addSonyPlatformTag($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node {
        id
        ... on Product {
          id
          tags
        }
      }
      userErrors {
        message
      }
    }
  }`;

const FIRST_PRODUCT_QUERY = `#graphql
  query firstProduct {
    products(first: 1) {
      nodes {
        id
      }
    }
  }`;

export const card: ActionCard = {
  id: "tag-products",
  category: "Mutations",
  title: "Tag the shop's products",
  description: "Adds the sony-platform tag to a product via tagsAdd.",
  requestKindLabel: "GraphQL mutation",
  order: 1,
  preview: TAG_PRODUCTS_QUERY,
  scope: "write_products",
};

export const run: RunFn = async (admin: AdminApiContext, _shop, form) => {
  let productId = String(form.get("productId") || "").trim();

  if (!productId) {
    const firstResponse = await admin.graphql(FIRST_PRODUCT_QUERY);
    const firstBody: any = await firstResponse.json();
    productId = firstBody?.data?.products?.nodes?.[0]?.id ?? "";
    if (!productId) {
      return { error: "No products found to tag — seed a demo product first." };
    }
  }

  const response = await admin.graphql(TAG_PRODUCTS_QUERY, {
    variables: { id: productId, tags: ["sony-platform"] },
  });
  const body: any = await response.json();

  const userErrors = body?.data?.tagsAdd?.userErrors ?? [];
  if (userErrors.length > 0) {
    return {
      data: body.data,
      extensions: body.extensions,
      error: userErrors.map((e: { message: string }) => e.message).join("; "),
    };
  }

  return { data: body.data, extensions: body.extensions };
};
