// [DEMO] [SLIDE §6] API Console (SHOW-02) — pick a store and an action card, see the
// exact GraphQL/HTTP it will run, click Run, and read the raw response plus the live
// extensions.cost query-cost/throttle meter. Cards auto-register from
// app/showcase/*.server.ts via registry.server.ts's import.meta.glob — this shell
// never needs editing to add a card (see 05-05..05-08).
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { CARDS, RUNNERS } from "../showcase/registry.server";
import { ensureScope } from "../lib/scopesClient";
import type { ActionCard, ActionCardCategory } from "../showcase/types";

const CATEGORY_ORDER: ActionCardCategory[] = [
  "Mutations",
  "Bulk operations",
  "Modules (inbound/outbound)",
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const stores = await db.store.findMany({ orderBy: { installedAt: "desc" } });
  return {
    currentShop: session.shop,
    stores: stores.map((s) => ({
      shopifyDomain: s.shopifyDomain,
      status: s.status,
    })),
    cards: CARDS,
  };
};

// Every response the "run-card" intent can produce — one shape so fetcher.data stays
// a single type across success/error/unknown-card branches (not a discriminated union
// missing fields on some members).
type RunCardResult = {
  ok: boolean;
  cardId?: string;
  data?: unknown;
  extensions?: unknown;
  error?: string;
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<RunCardResult> => {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "run-card") {
    const cardId = String(form.get("cardId"));
    // Own-property check: never let an inherited member masquerade as a card runner.
    const runner = Object.hasOwn(RUNNERS, cardId) ? RUNNERS[cardId] : undefined;
    if (!runner) return { ok: false, cardId, error: "Unknown card" };
    try {
      const result = await runner(admin, session.shop, form);
      return { ok: !result.error, cardId, ...result };
    } catch (err) {
      // The Shopify SDK throws a Response (not an Error) for 401/429/5xx — that IS
      // React Router's re-auth control flow. Swallowing it here would leave the
      // session unrefreshed and every later card silently dead. Propagate it.
      if (err instanceof Response) throw err;
      return {
        ok: false,
        cardId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { ok: false, error: "Unknown intent" };
};

const CODE_BLOCK_STYLE: CSSProperties = {
  margin: 0,
  overflowX: "auto",
  maxHeight: "320px",
  overflowY: "auto",
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  fontSize: "13px",
  lineHeight: 1.4,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

function Stat({
  value,
  label,
  warning,
}: {
  value: string | number;
  label: string;
  warning?: boolean;
}) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
      minInlineSize="120px"
    >
      <s-stack direction="block" gap="small">
        <s-heading>{String(value)}</s-heading>
        <s-text color="subdued">{label}</s-text>
        {warning && <s-badge tone="warning">Throttle budget low</s-badge>}
      </s-stack>
    </s-box>
  );
}

function CardTile({
  card,
  selected,
  onSelect,
}: {
  card: ActionCard;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-heading>{card.title}</s-heading>
          {selected && <s-badge tone="info">Selected</s-badge>}
        </s-stack>
        <s-text color="subdued">
          {card.description} · {card.requestKindLabel}
        </s-text>
        <s-button variant="tertiary" onClick={onSelect}>
          Select
        </s-button>
      </s-stack>
    </s-box>
  );
}

interface QueryCostExtensions {
  cost?: {
    requestedQueryCost?: number;
    actualQueryCost?: number;
    throttleStatus?: {
      maximumAvailable?: number;
      currentlyAvailable?: number;
    };
  };
}

interface BulkResultData {
  status?: string;
  url?: string;
  // The operation the "start" run kicked off — rounded back into "Check status" so we
  // report on THIS export, not a previous rehearsal's (see bulkExportProducts.server.ts).
  id?: string;
}

// Generic, field-driven — any card's result carrying editorPreviewUrl gets a link,
// no card-id gating needed (zero-edits-per-new-card, see 05-04-SUMMARY).
interface PreviewLinkData {
  editorPreviewUrl?: string;
}

// The detail panel — request preview, Run, raw response, cost meter, and the generic
// bulk-kind branch (Run/Check status/Download JSONL) that 05-06's card plugs into.
function DetailPanel({
  card,
  shopify,
}: {
  card: ActionCard;
  shopify: ReturnType<typeof useAppBridge>;
}) {
  const fetcher = useFetcher<typeof action>();
  const [declined, setDeclined] = useState(false);
  // "App Bridge broke" is a different story from "you declined" — keep it separate
  // so a failed scope request surfaces instead of silently doing nothing (WR-07).
  const [scopeError, setScopeError] = useState<string | null>(null);
  // Remembers the bulk operation this panel started, so "Check status" asks about
  // that export and not the newest finish webhook on the shop.
  const [startedOpId, setStartedOpId] = useState<string | null>(null);
  const busy = fetcher.state !== "idle";

  const result = fetcher.data?.cardId === card.id ? fetcher.data : undefined;
  const cost = (result?.extensions as QueryCostExtensions | undefined)?.cost;
  const requested = cost?.requestedQueryCost;
  const actual = cost?.actualQueryCost;
  const available = cost?.throttleStatus?.currentlyAvailable;
  const max = cost?.throttleStatus?.maximumAvailable;
  const lowBudget =
    typeof available === "number" && typeof max === "number" && max > 0
      ? available / max < 0.2
      : false;

  const bulkData =
    card.kind === "bulk" ? (result?.data as BulkResultData | undefined) : undefined;
  const previewUrl = (result?.data as PreviewLinkData | undefined)?.editorPreviewUrl;

  // A "start" run echoes back the operation id — hold on to it so the next
  // "Check status" can name the export it means.
  const returnedOpId = bulkData?.id;
  useEffect(() => {
    if (returnedOpId) setStartedOpId(returnedOpId);
  }, [returnedOpId]);

  const runCard = async (op?: "start" | "status") => {
    setDeclined(false);
    setScopeError(null);
    if (card.scope) {
      const { granted, error } = await ensureScope(shopify, card.scope);
      if (error) {
        // App Bridge / network failure — not a decline. Surface it distinctly.
        setScopeError(error);
        return;
      }
      if (!granted) {
        // MOD-02 precedent: decline is a state, not an error.
        setDeclined(true);
        return;
      }
    }
    // Starting a new export retires the previous operation id immediately, so a
    // fast "Check status" can never answer with the old export's result.
    if (op === "start") setStartedOpId(null);
    fetcher.submit(
      {
        intent: "run-card",
        cardId: card.id,
        ...(op ? { op } : {}),
        ...(op === "status" && startedOpId ? { bulkOperationId: startedOpId } : {}),
      },
      { method: "post" },
    );
  };

  const runLabel = card.scope ? "Request permission & run" : "Run";

  return (
    <s-section heading={card.title}>
      <s-stack direction="block" gap="base">
        {/* (a) request preview */}
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <pre style={CODE_BLOCK_STYLE}>
            <code>{card.preview}</code>
          </pre>
        </s-box>

        {card.scope && !result && (
          <s-text color="subdued">
            This card needs the {card.scope} scope, which hasn&apos;t been granted yet.
          </s-text>
        )}

        {/* (b) Run button(s) — the bulk-kind card adds a "Check status" tertiary button */}
        <s-stack direction="inline" gap="base">
          <s-button
            variant="primary"
            onClick={() => runCard(card.kind === "bulk" ? "start" : undefined)}
            {...(busy ? { loading: true } : {})}
          >
            {runLabel}
          </s-button>
          {card.kind === "bulk" && (
            <s-button
              variant="tertiary"
              onClick={() => runCard("status")}
              {...(busy ? { loading: true } : {})}
            >
              Check status
            </s-button>
          )}
        </s-stack>

        {declined && (
          <s-banner tone="warning" heading="Module unavailable">
            <s-paragraph>
              {card.scope} was declined. You can keep using the rest of the console
              and grant it later.
            </s-paragraph>
          </s-banner>
        )}

        {scopeError && (
          <s-banner tone="critical" heading="Permission request failed">
            <s-paragraph>
              Couldn&apos;t reach the App Bridge scopes API ({scopeError}). This is a
              connection problem, not a decline — try again.
            </s-paragraph>
          </s-banner>
        )}

        {result?.error && (
          <s-banner tone="critical" heading="Run failed">
            <s-paragraph>{result.error}. Check the request above and try again.</s-paragraph>
          </s-banner>
        )}

        {card.kind === "bulk" && bulkData?.status && (
          <s-badge tone={bulkData.status === "COMPLETED" ? "success" : "info"}>
            {bulkData.status === "COMPLETED" ? "Completed" : "Running…"}
          </s-badge>
        )}
        {card.kind === "bulk" && bulkData?.url && (
          <s-link href={bulkData.url}>Download JSONL</s-link>
        )}

        {/* [SLIDE §6] SHOW-10 theme-deployment preview link, fed by the run result */}
        {previewUrl && (
          <s-link href={previewUrl}>Preview in theme editor →</s-link>
        )}

        {/* (c) raw response */}
        {result?.data !== undefined && (
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <pre style={CODE_BLOCK_STYLE}>
              <code>{JSON.stringify(result.data, null, 2)}</code>
            </pre>
          </s-box>
        )}

        {/* (d) cost / throttle meter — extensions.cost -> Requested / Actual / Available-of-max */}
        {cost && (
          <s-stack direction="inline" gap="base">
            <Stat value={requested ?? 0} label="Requested" />
            <Stat value={actual ?? 0} label="Actual" />
            <Stat value={`${available ?? 0} / ${max ?? 0}`} label="Available / max" warning={lowBudget} />
          </s-stack>
        )}
      </s-stack>
    </s-section>
  );
}

export default function Playground() {
  const { currentShop, stores, cards } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const [selectedShop, setSelectedShop] = useState(currentShop);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? null;
  const categorized = CATEGORY_ORDER.map((category) => ({
    category,
    cards: cards.filter((c) => c.category === category),
  })).filter((group) => group.cards.length > 0);

  return (
    <s-page heading="API Console">
      <s-section heading="Store">
        {stores.length === 0 ? (
          <s-stack direction="block" gap="base">
            <s-text type="strong">No stores registered yet</s-text>
            <s-paragraph>
              Install the app on a development store first — it will appear here
              automatically.
            </s-paragraph>
          </s-stack>
        ) : (
          <s-stack direction="block" gap="base">
            <s-select
              label="Store"
              value={selectedShop}
              onChange={(event) => setSelectedShop(event.currentTarget.value)}
            >
              {stores.map((s) => (
                <s-option key={s.shopifyDomain} value={s.shopifyDomain}>
                  {s.shopifyDomain}
                </s-option>
              ))}
            </s-select>
            {/* This picker navigates the registry — it deliberately does NOT retarget
                runs. Cards always execute in the logged-in shop's admin context;
                running one session's cards against another merchant's store would be
                a real security hole, so the control must not imply it. */}
            <s-text color="subdued">
              Cards always run against the logged-in store ({currentShop}). This
              picker only chooses whose registry row to open.
            </s-text>
            <s-link href={`/app/registry/${encodeURIComponent(selectedShop)}`}>
              View in registry →
            </s-link>
          </s-stack>
        )}
      </s-section>

      {categorized.map(({ category, cards: categoryCards }) => (
        <s-section key={category} heading={category}>
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            {categoryCards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                selected={card.id === selectedCardId}
                onSelect={() => setSelectedCardId(card.id)}
              />
            ))}
          </s-grid>
        </s-section>
      ))}

      {selectedCard ? (
        <DetailPanel key={selectedCard.id} card={selectedCard} shopify={shopify} />
      ) : (
        cards.length > 0 && (
          <s-section>
            <s-text color="subdued">
              Select a card below to see the exact request it will run.
            </s-text>
          </s-section>
        )
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
