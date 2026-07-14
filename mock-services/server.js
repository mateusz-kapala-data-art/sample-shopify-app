// mock-services/server.js — zero deps, ESM (root package.json "type": "module" applies)
// [SHOWCASE 8/9] stand-ins for the two outbound integrations the showcase talks TO:
// NetSuite (order push) and Fansifter (connection status). Not a Shopify API — a local,
// localhost-only stub so SHOW-08/09 have a real HTTP target instead of a faked in-process call.
//
//   node mock-services/server.js     # run standalone (fallback if the bg role misbehaves —
//                                     # see scripts/demo-reset.md)
import { createServer } from "node:http";

const PORT = process.env.MOCK_SERVICES_PORT || 3457;

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/netsuite/orders") {
    let body = "";
    for await (const chunk of req) body += chunk;
    console.log("[mock-services] netsuite/orders received:", JSON.parse(body || "{}"));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, receivedAt: new Date().toISOString() }));
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/fansifter/status/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ connected: true, checkedAt: new Date().toISOString() }));
    return;
  }

  res.writeHead(404).end();
});

// Bind localhost only — this is a demo stand-in, never a deployed service (T-05.02-01).
server.listen(PORT, "127.0.0.1", () =>
  console.log(`[mock-services] listening on :${PORT}`),
);
