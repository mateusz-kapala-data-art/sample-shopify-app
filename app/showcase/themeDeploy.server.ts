// [SHOWCASE] SHOW-10 — "Theme deployment": requests write_themes at runtime, duplicates
// the shop's MAIN theme into a new UNPUBLISHED copy, then themeFilesUpserts
// snippets/sony-platform.liquid onto that DUPLICATE only — never the live/published
// theme (a hard safety invariant, T-05.08-02). Both mutations additionally require a
// Shopify-granted Online Store Protected Scope Exemption beyond write_themes itself
// (RESEARCH.md Pitfall 4); ACCESS_DENIED here means "exemption not yet granted," not a
// generic failure, and is surfaced distinctly so the console reads it honestly rather
// than as a broken run.
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ActionCard, RunFn } from "./types";

export const MAIN_THEME_QUERY = `#graphql
  query mainTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes {
        id
        name
      }
    }
  }`;

export const THEME_DUPLICATE_MUTATION = `#graphql
  mutation duplicateSonyPlatformTheme($id: ID!, $name: String!) {
    themeDuplicate(id: $id, name: $name) {
      theme {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }`;

export const THEME_FILES_UPSERT_MUTATION = `#graphql
  mutation upsertSonyPlatformSnippet($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
    themeFilesUpsert(themeId: $themeId, files: $files) {
      upsertedThemeFiles {
        filename
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

const SNIPPET_FILENAME = "snippets/sony-platform.liquid";
const SNIPPET_CONTENT = `{% comment %} [SHOWCASE] SHOW-10 — deployed by the Sony Platform app's Theme deployment card. Never written to the live/published theme. {% endcomment %}\n<div class="sony-platform-snippet">Sony Platform module active</div>\n`;

export const card: ActionCard = {
  id: "theme-deploy",
  category: "Modules (inbound/outbound)",
  title: "Theme deployment",
  description:
    "Duplicates the main theme to an unpublished copy and upserts snippets/sony-platform.liquid onto that duplicate only — never the live theme.",
  requestKindLabel: "GraphQL mutation (themeDuplicate + themeFilesUpsert)",
  order: 4,
  preview: `${MAIN_THEME_QUERY}\n\n${THEME_DUPLICATE_MUTATION}\n\n${THEME_FILES_UPSERT_MUTATION}`,
  scope: "write_themes",
};

export const run: RunFn = async (admin: AdminApiContext, _shop, _form) => {
  const mainResponse = await admin.graphql(MAIN_THEME_QUERY);
  const mainBody: any = await mainResponse.json();
  const mainTheme = mainBody?.data?.themes?.nodes?.[0];
  if (!mainTheme?.id) {
    return { error: "No main theme found to duplicate." };
  }

  const duplicateResponse = await admin.graphql(THEME_DUPLICATE_MUTATION, {
    variables: {
      id: mainTheme.id,
      name: `Sony Platform Demo — ${new Date().toISOString()}`,
    },
  });
  const duplicateBody: any = await duplicateResponse.json();

  // Pitfall 4: ACCESS_DENIED here means "exemption not yet granted," a distinct,
  // expected state — not a generic run failure.
  if (hasAccessDenied(duplicateBody)) {
    return {
      error: "Theme exemption not yet granted — see rehearsal fallback",
    };
  }

  const duplicateUserErrors = duplicateBody?.data?.themeDuplicate?.userErrors ?? [];
  if (duplicateUserErrors.length > 0) {
    return {
      data: duplicateBody.data,
      extensions: duplicateBody.extensions,
      error: duplicateUserErrors
        .map((e: { message: string }) => e.message)
        .join("; "),
    };
  }

  const duplicatedThemeId = duplicateBody?.data?.themeDuplicate?.theme?.id;
  if (!duplicatedThemeId) {
    return { error: "themeDuplicate returned no theme id." };
  }

  const upsertResponse = await admin.graphql(THEME_FILES_UPSERT_MUTATION, {
    variables: {
      themeId: duplicatedThemeId,
      files: [{ filename: SNIPPET_FILENAME, body: { type: "TEXT", value: SNIPPET_CONTENT } }],
    },
  });
  const upsertBody: any = await upsertResponse.json();

  if (hasAccessDenied(upsertBody)) {
    return {
      error: "Theme exemption not yet granted — see rehearsal fallback",
    };
  }

  const upsertUserErrors = upsertBody?.data?.themeFilesUpsert?.userErrors ?? [];
  if (upsertUserErrors.length > 0) {
    return {
      data: upsertBody.data,
      extensions: upsertBody.extensions,
      error: upsertUserErrors.map((e: { message: string }) => e.message).join("; "),
    };
  }

  const editorPreviewUrl = `https://admin.shopify.com/store/${_shop.replace(/\.myshopify\.com$/, "")}/themes/${duplicatedThemeId.replace(/\D/g, "")}/editor`;

  return {
    data: {
      duplicatedThemeId,
      editorPreviewUrl,
      files: upsertBody?.data?.themeFilesUpsert?.upsertedThemeFiles ?? [],
    },
    extensions: upsertBody.extensions,
  };
};

// ACCESS_DENIED can surface either as a top-level GraphQL error or as a userError
// code/message on either mutation — check both shapes so the exemption-gap message
// is distinct wherever Shopify puts it.
function hasAccessDenied(body: any): boolean {
  const topLevel: any[] = body?.errors ?? [];
  if (topLevel.some((e) => e?.extensions?.code === "ACCESS_DENIED")) return true;

  const allUserErrors: any[] = [
    ...(body?.data?.themeDuplicate?.userErrors ?? []),
    ...(body?.data?.themeFilesUpsert?.userErrors ?? []),
  ];
  return allUserErrors.some(
    (e) => e?.code === "ACCESS_DENIED" || /access.?denied/i.test(e?.message ?? ""),
  );
}
