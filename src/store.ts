/**
 * Append-only trade log. One JSON object per line (JSONL) so the file is:
 *   - cheap to append to while the agent runs
 *   - trivially diffable / inspectable by a judge
 *   - the literal "verifiable usage record" the submission form asks for
 *
 * We deliberately do NOT use a database. The whole point is that the audit
 * trail is a plain, portable file anyone can read or feed to the engine.
 */
import { appendFileSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DecisionRecord } from "./types.ts";

// Default log path; override with GLASSBOX_LOG to autopsy any external agent's log.
export const LOG_PATH = process.env.GLASSBOX_LOG ?? "data/trades.jsonl";

function ensureDir(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** Append one decision record as a line. Called by the agent at entry. */
export function appendRecord(rec: DecisionRecord, path = LOG_PATH): void {
  ensureDir(path);
  appendFileSync(path, JSON.stringify(rec) + "\n", "utf8");
}

/** Load every record. Called by the engine. */
export function loadRecords(path = LOG_PATH): DecisionRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as DecisionRecord);
}

/** Rewrite the whole log (used when we backfill outcomes onto open trades). */
export function rewriteRecords(records: DecisionRecord[], path = LOG_PATH): void {
  ensureDir(path);
  writeFileSync(path, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}
