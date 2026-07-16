// [DEMO 3-4] [DECK F/G] REAL app version history — captured from
// `shopify app versions list` into app/data/app-versions.json (never hand-authored).
// There is no live source a hosted app can read: the Admin API doesn't expose app
// versions, the Partner API's `app` query doesn't either, and the Shopify CLI can't run
// on Vercel. So the list is captured at deploy time. Refresh it after a release with
// `npm run versions:capture` (see scripts/capture-versions.mjs), then commit + push.
import versions from "../data/app-versions.json";

export type AppVersion = {
  versionTag: string;
  createdAt: string;
  status: string;
  message: string;
};

export const APP_VERSIONS: AppVersion[] = versions;
