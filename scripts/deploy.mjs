#!/usr/bin/env node
// One-step deploy that keeps the in-app Versions route truthful:
//   1. `shopify app deploy`            — create/release the app version
//   2. capture-versions                — write the real list to app/data/app-versions.json
//   3. commit + push that file only    — Vercel redeploys, Versions route shows the new list
//
// Run:  npm run deploy            (interactive)
//       npm run deploy -- --force (pass any flags through to `shopify app deploy`)
//
// Rationale: a hosted app has no live source for `shopify app deploy` versions (Admin API
// and Partner API don't expose them, and the CLI can't run on Vercel), so the list is
// captured here at deploy time and committed. See scripts/capture-versions.mjs.
import { execSync } from "node:child_process";

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

// 1. Deploy the app version (forward any extra args, e.g. --force / --message "...").
const extraArgs = process.argv.slice(2).join(" ");
run(`shopify app deploy ${extraArgs}`.trim());

// 2. Refresh the captured version list.
run("node scripts/capture-versions.mjs");

// 3. Commit + push ONLY the versions file, and only if it changed.
const changed = execSync("git status --porcelain app/data/app-versions.json", {
  encoding: "utf8",
}).trim();

if (!changed) {
  console.log("\napp-versions.json unchanged — nothing to push.");
  process.exit(0);
}

try {
  run("git add app/data/app-versions.json");
  run('git commit -m "chore: refresh app versions after deploy"');
  run("git push");
  console.log("\n✓ Deployed, captured versions, and pushed — Vercel will redeploy with the updated Versions route.");
} catch {
  console.error("\nDeployed + captured, but the git commit/push failed. Commit app/data/app-versions.json and push manually to update the hosted Versions route.");
  process.exit(1);
}
