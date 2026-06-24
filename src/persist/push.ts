/**
 * Syncs data/trades.jsonl, data/report.json, and docs/index.html to GitHub
 * every PUSH_INTERVAL_MINUTES (default 60) using the GitHub Contents API.
 *
 * Uses HTTP PUT instead of git push — works reliably on ephemeral servers
 * (Render, Railway, Fly) where git credential setup is flaky.
 *
 * Required env vars:
 *   GITHUB_TOKEN   — a classic PAT with "repo" scope, or fine-grained with
 *                    "Contents: read and write" on the repo
 *   GITHUB_REPO    — e.g. IamHarrie-Labs/glass-box
 *   GITHUB_BRANCH  — default: master
 */
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const INTERVAL_MS = Number(process.env.PUSH_INTERVAL_MINUTES ?? 60) * 60 * 1000;
const REPO   = process.env.GITHUB_REPO   ?? "IamHarrie-Labs/glass-box";
const BRANCH = process.env.GITHUB_BRANCH ?? "master";
const TOKEN  = process.env.GITHUB_TOKEN;

const FILES_TO_SYNC = [
  "data/trades.jsonl",
  "data/report.json",
  "docs/index.html",
];

async function pushFile(path: string, ts: string): Promise<boolean> {
  if (!existsSync(path)) return true; // skip missing files silently

  const content = readFileSync(path);
  const encoded = content.toString("base64");

  const apiBase = `https://api.github.com/repos/${REPO}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "glass-box-agent",
    Accept: "application/vnd.github+json",
  };

  // Get the current SHA (required by the API to update an existing file)
  let sha: string | undefined;
  const getRes = await fetch(`${apiBase}?ref=${BRANCH}`, { headers });
  if (getRes.ok) {
    const data: any = await getRes.json();
    sha = data.sha;
  } else if (getRes.status !== 404) {
    // 404 = new file (fine), anything else is a real error
    console.error(`[push] GET ${path} → ${getRes.status}`);
    return false;
  }

  const body: any = {
    message: `agent log update ${ts} — ${path}`,
    content: encoded,
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiBase, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const txt = await putRes.text();
    console.error(`[push] PUT ${path} → ${putRes.status}: ${txt.slice(0, 120)}`);
    return false;
  }

  return true;
}

function runLocal(cmd: string) {
  try { execSync(cmd, { stdio: "pipe" }); return true; }
  catch { return false; }
}

async function push() {
  if (!TOKEN) return;
  if (!existsSync("data/trades.jsonl")) return;

  // Rebuild autopsy + site so GitHub always has fresh data
  runLocal(`npx tsx src/engine/run.ts`);
  runLocal(`npx tsx src/report/site.ts`);

  const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
  let allOk = true;
  for (const file of FILES_TO_SYNC) {
    const ok = await pushFile(file, ts);
    if (!ok) allOk = false;
  }
  console.log(`[push] ${allOk ? "pushed to GitHub" : "push failed (see errors above)"} at ${ts}`);
}

export function startPusher() {
  if (!TOKEN) {
    console.warn("GITHUB_TOKEN not set — log persistence disabled. Agent will still run.");
    return;
  }
  console.log(`Log pusher started — syncing every ${INTERVAL_MS / 60000}m to ${REPO}`);
  push();
  setInterval(push, INTERVAL_MS);
}

// Run directly when invoked as a script (npm run push-log), but not when imported
const isMain = process.argv[1]?.endsWith("push.ts") || process.argv[1]?.endsWith("push.js");
if (isMain) startPusher();
