/**
 * Web Service entry point for Render (free tier).
 * Starts a tiny HTTP server on $PORT so Render's port check passes,
 * then runs the agent loop and log pusher in the same process.
 *
 * GET /           → serves docs/index.html (the Glass Box site)
 * GET /health     → { status: "ok", trades: N, uptime: Xs }
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { run as runAgent } from "./agent/run.ts";
import { startPusher } from "./persist/push.ts";

const PORT = Number(process.env.PORT ?? 3000);

// ── HTTP server ──────────────────────────────────────────────────────────────
const server = createServer((req, res) => {
  if (req.url === "/health") {
    let trades = 0;
    try {
      trades = readFileSync("data/trades.jsonl", "utf8").split("\n").filter(Boolean).length;
    } catch {}
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", trades, uptime: Math.floor(process.uptime()) }));
    return;
  }
  // serve the site for all other paths
  const html = existsSync("docs/index.html")
    ? readFileSync("docs/index.html", "utf8")
    : "<h1>Glass Box</h1><p>Site not built yet. Run npm run site.</p>";
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(PORT, () => {
  console.log(`Glass Box server listening on port ${PORT}`);
});

// ── agent + pusher ───────────────────────────────────────────────────────────
runAgent();
startPusher();
