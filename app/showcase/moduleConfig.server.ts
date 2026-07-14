// [SHOWCASE] SHOW-05 — "Module config": defines an app-owned metaobject type once
// (idempotent-guarded), upserts a per-store config entry, and reads it back — all
// under the write_metaobjects/write_metaobject_definitions scopes already required
// in the manifest (RESEARCH.md Assumption A4: no extra permissions needed).
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ActionCard, RunFn } from "./types";

const MODULE_CONFIG_TYPE = "$app:module_config";

export const DEFINE_QUERY = `#graphql
  mutation defineModuleConfig($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition {
        id
        type
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

export const UPSERT_QUERY = `#graphql
  mutation upsertModuleConfig($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject {
        id
        handle
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

export const READ_QUERY = `#graphql
  query readModuleConfig($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      id
      handle
      shippingEnabled: field(key: "shipping_enabled") {
        value
      }
    }
  }`;

export const card: ActionCard = {
  id: "module-config",
  category: "Mutations",
  title: "Module config",
  description:
    "Defines the app-owned $app:module_config metaobject once, upserts this store's config, and reads it back — no extra permissions beyond what's already granted.",
  requestKindLabel: "GraphQL define + upsert + read-back",
  order: 3,
  preview: `${DEFINE_QUERY}\n\n${UPSERT_QUERY}\n\n${READ_QUERY}`,
};

// Deterministic shop-slug handle: strip the .myshopify.com suffix.
function shopHandle(shop: string): string {
  return shop.replace(/\.myshopify\.com$/, "");
}

export const run: RunFn = async (admin: AdminApiContext, shop, _form) => {
  const defineResponse = await admin.graphql(DEFINE_QUERY, {
    variables: {
      definition: {
        name: "Module Config",
        type: MODULE_CONFIG_TYPE,
        fieldDefinitions: [
          {
            key: "shipping_enabled",
            name: "Shipping enabled",
            type: "boolean",
          },
        ],
      },
    },
  });
  const defineBody: any = await defineResponse.json();
  const defineErrors = defineBody?.data?.metaobjectDefinitionCreate?.userErrors ?? [];
  // Idempotency guard: swallow the "already taken" userError rather than pre-querying.
  const alreadyDefined = defineErrors.some(
    (e: { code?: string; message: string }) =>
      e.code === "TAKEN" || /already exists|taken/i.test(e.message),
  );
  if (defineErrors.length > 0 && !alreadyDefined) {
    return {
      data: { definition: defineBody.data },
      extensions: defineBody.extensions,
      error: defineErrors
        .map((e: { message: string }) => e.message)
        .join("; "),
    };
  }

  const handle = { type: MODULE_CONFIG_TYPE, handle: shopHandle(shop) };

  const upsertResponse = await admin.graphql(UPSERT_QUERY, {
    variables: {
      handle,
      metaobject: {
        fields: [{ key: "shipping_enabled", value: "true" }],
      },
    },
  });
  const upsertBody: any = await upsertResponse.json();
  const upsertErrors = upsertBody?.data?.metaobjectUpsert?.userErrors ?? [];
  if (upsertErrors.length > 0) {
    return {
      data: { definition: defineBody.data, upsert: upsertBody.data },
      extensions: upsertBody.extensions,
      error: upsertErrors
        .map((e: { message: string }) => e.message)
        .join("; "),
    };
  }

  const readResponse = await admin.graphql(READ_QUERY, {
    variables: { handle },
  });
  const readBody: any = await readResponse.json();

  return {
    data: {
      definition: defineBody.data,
      upsert: upsertBody.data,
      readback: readBody.data,
    },
    extensions: readBody.extensions,
  };
};
