// [DEMOS 3–4] Captured `shopify app versions list` output — the honest "rehearsed
// output captured at deploy time" fallback (deck section F/G). There is no live
// versions API call on stage; deploys/rollbacks happen in the CLI, and this static
// mirror lets the Versions route observe them without a tunnel. Dates are captured
// literals, never Date.now()/new Date() — the row order tells the demo story.
export type AppVersion = {
  version: string;
  createdAt: string;
  message: string;
  released: boolean;
  scopeChange: boolean;
};

export const APP_VERSIONS: AppVersion[] = [
  {
    version: "platform-app-1",
    createdAt: "2026-07-10",
    message: "Baseline: registry + webhooks",
    released: true,
    scopeChange: false,
  },
  {
    version: "platform-app-2",
    createdAt: "2026-07-12",
    message: "platform-badge copy v2",
    released: true,
    scopeChange: false,
  },
  {
    version: "platform-app-3",
    createdAt: "2026-07-14",
    message: "Add read_content required scope",
    released: false,
    scopeChange: true,
  },
];
