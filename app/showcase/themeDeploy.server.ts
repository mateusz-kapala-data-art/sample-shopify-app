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

// One rehearsed sentence for the exemption gap, wherever it surfaces.
const EXEMPTION_MESSAGE = "Theme exemption not yet granted — see rehearsal fallback";

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
  const main = await graphqlOrAccessDenied(admin, MAIN_THEME_QUERY);
  if (main.accessDenied) return { error: EXEMPTION_MESSAGE };
  const mainBody: any = main.body;
  const mainTheme = mainBody?.data?.themes?.nodes?.[0];
  if (!mainTheme?.id) {
    return { error: "No main theme found to duplicate." };
  }

  const duplicate = await graphqlOrAccessDenied(admin, THEME_DUPLICATE_MUTATION, {
    id: mainTheme.id,
    name: `Sony Platform Demo — ${new Date().toISOString()}`,
  });
  // Pitfall 4: ACCESS_DENIED here means "exemption not yet granted," a distinct,
  // expected state — not a generic run failure.
  if (duplicate.accessDenied) return { error: EXEMPTION_MESSAGE };
  const duplicateBody: any = duplicate.body;

  if (hasAccessDeniedUserError(duplicateBody)) {
    return { error: EXEMPTION_MESSAGE };
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
  // T-05.08-02 is a hard safety invariant, so enforce it here rather than trusting
  // an assumption about Shopify's response. The next call overwrites a theme file;
  // if that id is ever the live theme, we refuse instead of writing the storefront.
  if (duplicatedThemeId === mainTheme.id) {
    return { error: "Refusing to write: themeDuplicate returned the MAIN theme id." };
  }

  const upsert = await graphqlOrAccessDenied(admin, THEME_FILES_UPSERT_MUTATION, {
    themeId: duplicatedThemeId,
    files: [{ filename: SNIPPET_FILENAME, body: { type: "TEXT", value: SNIPPET_CONTENT } }],
  });
  if (upsert.accessDenied) return { error: EXEMPTION_MESSAGE };
  const upsertBody: any = upsert.body;

  if (hasAccessDeniedUserError(upsertBody)) {
    return { error: EXEMPTION_MESSAGE };
  }

  const upsertUserErrors = upsertBody?.data?.themeFilesUpsert?.userErrors ?? [];
  if (upsertUserErrors.length > 0) {
    return {
      data: upsertBody.data,
      extensions: upsertBody.extensions,
      error: upsertUserErrors.map((e: { message: string }) => e.message).join("; "),
    };
  }

  // Take the last path segment, not "strip every non-digit" — the latter only works
  // while no digit appears anywhere in the GID prefix, and would silently mangle the
  // id (404 link, no error) the day one does.
  const numericId = duplicatedThemeId.split("/").pop() ?? "";
  const storeHandle = _shop.replace(/\.myshopify\.com$/, "");
  const editorPreviewUrl = `https://admin.shopify.com/store/${storeHandle}/themes/${numericId}/editor`;

  return {
    data: {
      duplicatedThemeId,
      editorPreviewUrl,
      files: upsertBody?.data?.themeFilesUpsert?.upsertedThemeFiles ?? [],
    },
    extensions: upsertBody.extensions,
  };
};

// ACCESS_DENIED does NOT arrive as body.errors. On HTTP 200 with graphQLErrors the
// SDK throws GraphqlQueryError before admin.graphql returns
// (@shopify/shopify-api/lib/clients/common.js -> throwFailedRequest), and the app SDK
// re-throws any non-HttpResponseError untouched (handle-client-error.js). So the
// exemption gap — the single most likely failure for this card (RESEARCH Pitfall 4) —
// only ever reaches us as a throw. Catch it here, or the console shows a generic
// error instead of the rehearsed message.
async function graphqlOrAccessDenied(
  admin: AdminApiContext,
  query: string,
  variables?: object,
): Promise<{ body?: any; accessDenied?: boolean }> {
  try {
    const response = await admin.graphql(
      query,
      variables ? { variables } : undefined,
    );
    return { body: await response.json() };
  } catch (err) {
    // Re-auth / 401 / 429 / 5xx arrive as a Response — control flow, must propagate (CR-01).
    if (err instanceof Response) throw err;
    if (isAccessDeniedError(err)) return { accessDenied: true };
    throw err;
  }
}

// GraphqlQueryError carries the parsed body, so read the real error code rather than
// pattern-matching prose; fall back to the message for other shapes.
function isAccessDeniedError(err: unknown): boolean {
  const graphQLErrors: any[] =
    (err as { body?: { errors?: { graphQLErrors?: any[] } } })?.body?.errors
      ?.graphQLErrors ?? [];
  if (graphQLErrors.some((e) => e?.extensions?.code === "ACCESS_DENIED")) return true;
  return /access.?denied|exemption/i.test((err as Error)?.message ?? "");
}

// Belt-and-braces: neither ThemeDuplicateUserError nor OnlineStoreThemeFilesUpsertUserErrors
// currently defines an ACCESS_DENIED code, so this is unlikely to fire — kept because it is
// cheap and Shopify may add one.
function hasAccessDeniedUserError(body: any): boolean {
  const allUserErrors: any[] = [
    ...(body?.data?.themeDuplicate?.userErrors ?? []),
    ...(body?.data?.themeFilesUpsert?.userErrors ?? []),
  ];
  return allUserErrors.some(
    (e) => e?.code === "ACCESS_DENIED" || /access.?denied/i.test(e?.message ?? ""),
  );
}
