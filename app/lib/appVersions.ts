// [DEMO 3-4] [DECK F/G] REAL app version history — the captured output of
// `shopify app versions list --json`, never hand-authored (spec's "no fakes").
// Refresh before a rehearsal/session so the list reflects the latest deploys:
//
//   shopify app versions list --json \
//     | node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync(0,'utf8'));\
//       fs.writeFileSync('app/data/app-versions.json',JSON.stringify(\
//       r.map(v=>({versionTag:v.versionTag,createdAt:v.createdAt,status:v.status,\
//       message:v.message||''})),null,2)+'\n')"
//
// (Internal createdBy/versionId GIDs from the CLI are dropped — only display fields.)
import versions from "../data/app-versions.json";

export type AppVersion = {
  versionTag: string;
  createdAt: string;
  status: string;
  message: string;
};

export const APP_VERSIONS: AppVersion[] = versions;
