// [DEMO 3-4] [DECK F/G] LIVE app version history — server-only. Runs the real
// `shopify app versions list --json` at request time so a `shopify app deploy` on
// stage shows up the moment the presenter opens (or refreshes) the Versions route.
// Falls back to the last captured snapshot (app/data/app-versions.json) when the CLI
// isn't reachable (hosted/prod, or no Shopify session) so the route never breaks.
//
// Refresh the fallback snapshot before a session:
//   shopify app versions list --json \
//     | node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync(0,'utf8'));\
//       fs.writeFileSync('app/data/app-versions.json',JSON.stringify(\
//       r.map(v=>({versionTag:v.versionTag,createdAt:v.createdAt,status:v.status,\
//       message:v.message||''})),null,2)+'\n')"
import { exec as _exec } from "node:child_process";
import { promisify } from "node:util";
import capturedVersions from "../data/app-versions.json";

const exec = promisify(_exec);

export type AppVersion = {
  versionTag: string;
  createdAt: string;
  status: string;
  message: string;
};

// Keep only the display fields — the CLI also returns internal createdBy/versionId GIDs.
function normalize(raw: unknown): AppVersion[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v: any) => ({
    versionTag: String(v.versionTag ?? ""),
    createdAt: String(v.createdAt ?? ""),
    status: String(v.status ?? ""),
    message: String(v.message ?? ""),
  }));
}

export async function getAppVersions(): Promise<{
  versions: AppVersion[];
  source: "live" | "captured";
}> {
  try {
    const { stdout } = await exec("shopify app versions list --json", {
      cwd: process.cwd(),
      timeout: 15_000,
      maxBuffer: 4_000_000,
    });
    const versions = normalize(JSON.parse(stdout));
    if (versions.length === 0) throw new Error("empty version list");
    return { versions, source: "live" };
  } catch {
    // CLI unavailable / not authed / hosted runtime — show the last captured real snapshot.
    return { versions: capturedVersions as AppVersion[], source: "captured" };
  }
}
