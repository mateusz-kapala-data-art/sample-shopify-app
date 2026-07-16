// [ADDENDUM A2/A4] Shared presentation helpers so every demo route reads the same:
// a subdued deck-anchor subline that reconnects app <-> slide, plus the registry
// formatting helpers that were duplicated across the registry routes (IN-05).

// Deck-anchor subline (Addendum A2: "every route header carries a subdued Text line
// naming its deck anchor"). Rendered directly under the page heading on each route.
export function DeckAnchor({ children }: { children: React.ReactNode }) {
  return <s-text color="subdued">{children}</s-text>;
}

// Status badge tone — live/active reads success, password/uninstalled reads attention.
export function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "active" || status === "live") return "success";
  if (status === "password" || status === "uninstalled") return "warning";
  return "neutral";
}

// Strip protocol/trailing slash so a primary domain reads cleanly.
export function cleanHost(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// One placeholder everywhere (IN-05 flagged "Never" vs "—" drift between routes).
export function formatSynced(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function splitScopes(csv: string | null): string[] {
  return csv ? csv.split(",").map((s) => s.trim()).filter(Boolean) : [];
}
