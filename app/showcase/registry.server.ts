// [SHOWCASE] auto-registry — collects every app/showcase/*.server.ts card module via
// Vite's import.meta.glob at build time. Dropping a new card file here is the ONLY
// step required to add it to the API Console (SHOW-02); this file and the shell never
// need editing. Server-only (.server suffix) so card business logic never enters the
// client bundle.
import type { ActionCard, RunFn } from "./types";

interface CardModule {
  card?: ActionCard;
  run?: RunFn;
}

const modules = import.meta.glob<CardModule>("./*.server.ts", {
  eager: true,
});

const cardEntries = Object.entries(modules)
  // Exclude this file itself (no exported `card`/`run`) and any future non-card module.
  .filter(([, mod]) => mod.card && mod.run)
  .map(([, mod]) => mod as Required<CardModule>);

export const CARDS: ActionCard[] = cardEntries
  .map((mod) => mod.card)
  .sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.order - b.order;
  });

// Null-prototype: cardId comes straight off the form, and a plain object would let
// `RUNNERS["toString"]` resolve to Object.prototype.toString and sail past the
// "unknown card" guard. Only real cards should ever be reachable here.
export const RUNNERS: Record<string, RunFn> = Object.assign(
  Object.create(null),
  Object.fromEntries(cardEntries.map((mod) => [mod.card.id, mod.run])),
);
