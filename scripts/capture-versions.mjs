#!/usr/bin/env node
// Capture the REAL app version history from the Shopify CLI into
// app/data/app-versions.json, which the hosted app reads. There is NO live source for
// this on a hosted app — the Admin API doesn't expose app versions, the Partner API
// doesn't either, and the Shopify CLI can't run on Vercel — so the honest approach is
// to capture at deploy time and commit the result.
//
// Usage (on your machine, after `shopify app deploy` creates a new version):
//   npm run versions:capture
//   git add app/data/app-versions.json && git commit -m "chore: refresh app versions" && git push
// Vercel redeploys and the Versions route shows the new list.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "app/data/app-versions.json";

let raw;
try {
  raw = execSync("shopify app versions list --json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
} catch (err) {
  console.error("Failed to run `shopify app versions list`. Are you logged in (shopify app dev once) and is the app linked?");
  process.exit(1);
}

const versions = JSON.parse(raw).map((v) => ({
  versionTag: v.versionTag,
  createdAt: v.createdAt,
  status: v.status,
  message: v.message || "",
}));

writeFileSync(OUT, JSON.stringify(versions, null, 2) + "\n");
console.log(`Captured ${versions.length} version(s) to ${OUT}: ${versions.map((v) => `${v.versionTag} (${v.status})`).join(", ")}`);
