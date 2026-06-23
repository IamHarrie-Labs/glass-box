/**
 * Commits data/trades.jsonl to GitHub every PUSH_INTERVAL_MINUTES (default 60).
 * Run alongside the agent on any server that has git + a GITHUB_TOKEN set.
 *
 * Required env vars:
 *   GITHUB_TOKEN   — a fine-grained PAT with "Contents: read and write" on the repo
 *   GITHUB_REPO    — e.g. IamHarrie-Labs/glass-box
 *   GITHUB_BRANCH  — default: master
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const INTERVAL_MS = Number(process.env.PUSH_INTERVAL_MINUTES ?? 60) * 60 * 1000;
const REPO   = process.env.GITHUB_REPO   ?? "IamHarrie-Labs/glass-box";
const BRANCH = process.env.GITHUB_BRANCH ?? "master";
const TOKEN  = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("GITHUB_TOKEN not set — log persistence disabled.");
  process.exit(0);
}

function run(cmd: string) {
  try { execSync(cmd, { stdio: "pipe" }); return true; }
  catch { return false; }
}

function push() {
  if (!existsSync("data/trades.jsonl")) return;

  // rebuild autopsy + site so GitHub Pages always has fresh data
  run(`npx tsx src/engine/run.ts`);
  run(`npx tsx src/report/site.ts`);

  const remote = `https://x-access-token:${TOKEN}@github.com/${REPO}.git`;
  run(`git config user.email "agent@glassbox"`);
  run(`git config user.name "Glass Box Agent"`);
  run(`git remote set-url origin ${remote}`);
  run(`git add data/trades.jsonl data/report.json docs/index.html`);
  const changed = run(`git diff --cached --quiet`) === false;
  if (!changed) { console.log(`[push] no changes`); return; }
  const ts = new Date().toISOString().slice(0,16).replace("T"," ");
  run(`git commit -m "agent log update ${ts}"`);
  const ok = run(`git push origin ${BRANCH}`);
  console.log(`[push] ${ok ? "pushed to GitHub" : "push failed"} at ${ts}`);
}

console.log(`Log pusher started — syncing every ${INTERVAL_MS / 60000}m to ${REPO}`);
push(); // immediate first push
setInterval(push, INTERVAL_MS);
