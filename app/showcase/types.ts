// [SHOWCASE] shared ActionCard contract — every app/showcase/*.server.ts module exports
// a `card: ActionCard` (serializable metadata, safe to return from a loader) plus a
// `run: RunFn` (server-only, executes the request). registry.server.ts auto-collects
// both via import.meta.glob so new cards never require editing this file or the shell.
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export type ActionCardCategory =
  | "Mutations"
  | "Bulk operations"
  | "Modules (inbound/outbound)";

export interface ActionCard {
  /** Kebab-case, unique across all cards — also the RUNNERS map key. */
  id: string;
  category: ActionCardCategory;
  title: string;
  description: string;
  /** Plain text shown inline in the description, e.g. "GraphQL mutation" — never a badge. */
  requestKindLabel: string;
  /** Sort order within a category (ascending). */
  order: number;
  /** The exact GraphQL/HTTP text rendered in the request-preview code block. */
  preview: string;
  /** Optional Shopify scope required before Run — gates the "Request permission & run" flow. */
  scope?: string;
  /** "bulk" opts a card into the webhook-driven Run/Check-status/Download-JSONL UI branch. */
  kind?: "bulk";
}

export type RunFn = (
  admin: AdminApiContext,
  shop: string,
  form: FormData,
) => Promise<{ data?: unknown; extensions?: unknown; error?: string }>;
