/**
 * `npm run agent` — the live loop.
 *
 * Each tick: perceive real Bitget market data -> decide -> open a paper trade
 * (logging the stated thesis BEFORE the outcome is known) -> close any matured
 * positions at the real later price. Runs continuously so the trade log grows
 * into the "verifiable usage record" the submission needs.
 *
 * Config via env (all optional):
 *   SYMBOLS       comma-separated pairs, rotated per tick  default BTCUSDT,ETHUSDT,SOLUSDT
 *   SYMBOL        single pair (back-compat; overrides SYMBOLS if SYMBOLS unset)
 *   TICK_SECONDS  seconds between ticks                  default 3600 (1h)
 *   HOLD_MINUTES  how long to hold each paper position   default 240 (4h)
 *   MAX_TICKS     stop after N ticks (0 = run forever)   default 0
 *
 * Quick live smoke test (opens + closes within ~1 min):
 *   TICK_SECONDS=10 HOLD_MINUTES=0.3 MAX_TICKS=6 npm run agent
 */
// Load keys/config from a .env file at the project root, if present. No-op when
// the file is absent, so rules-only / CI runs are unaffected.
try { process.loadEnvFile(); } catch { /* no .env file — fine */ }

import { fetchSnapshot } from "../bitget/market.ts";
import { decide, type Decision } from "./strategy.ts";
import { decideLLM, llmEnabled } from "./llm.ts";
import { openPosition, closeMatured, openCount } from "./paper.ts";
import type { MarketSnapshot } from "../types.ts";

const USE_LLM = llmEnabled();

/** Decide with the LLM when configured; fall back to rules on any LLM error so
 *  a flaky model call never stalls the loop. */
async function decideWith(snap: MarketSnapshot, pair: string): Promise<{ decision: Decision | null; brain: string }> {
  if (USE_LLM) {
    try {
      return { decision: await decideLLM(snap, pair), brain: "llm" };
    } catch (e) {
      console.error(`  (llm failed, using rules: ${(e as Error).message})`);
      return { decision: decide(snap), brain: "rules*" };
    }
  }
  return { decision: decide(snap), brain: "rules" };
}

// One or more symbols, comma-separated. The loop rotates through them so the
// "real driver" finding can't be a single-asset tautology (BTC predicting BTC).
const SYMBOLS = (process.env.SYMBOLS ?? process.env.SYMBOL ?? "BTCUSDT,ETHUSDT,SOLUSDT")
  .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
const TICK_SECONDS = Number(process.env.TICK_SECONDS ?? 3600);
const HOLD_MINUTES = Number(process.env.HOLD_MINUTES ?? 240);
const MAX_TICKS = Number(process.env.MAX_TICKS ?? 0);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);

console.log(`Glass Box agent · ${SYMBOLS.join(", ")} · brain: ${USE_LLM ? `LLM (${process.env.LLM_MODEL ?? "llama-3.1-8b-instant"})` : "rules"} · ` +
  `tick ${TICK_SECONDS}s · hold ${HOLD_MINUTES}m` +
  (MAX_TICKS ? ` · ${MAX_TICKS} ticks` : " · continuous"));
console.log("Ctrl+C to stop. Trades stream to data/trades.jsonl.\n");

export async function run() {
  let tick = 0;
  while (true) {
    tick++;
    try {
      const symbol = SYMBOLS[(tick - 1) % SYMBOLS.length]; // rotate assets
      const { pair, snapshot } = await fetchSnapshot(symbol);
      const { decision } = await decideWith(snapshot, pair);

      if (decision) {
        const rec = openPosition(pair, decision.side, snapshot, decision.thesis);
        console.log(
          `[${ts()}] OPEN  ${rec.tradeId} ${pair.padEnd(8)} ${decision.side.toUpperCase().padEnd(5)} @${snapshot.price.toFixed(1)} ` +
          `"${decision.thesis.primaryDriver}" conf ${decision.thesis.confidence} — ${decision.thesis.naturalLanguage}`
        );
      } else {
        console.log(`[${ts()}] flat  ${pair} (no setup: rsi ${snapshot.rsi14.toFixed(0)}, 1h ${(snapshot.btc1hReturn * 100).toFixed(2)}%)`);
      }

      const closed = await closeMatured(HOLD_MINUTES);
      if (closed > 0) console.log(`[${ts()}] closed ${closed} matured position(s). ${openCount()} still open.`);
    } catch (e) {
      console.error(`[${ts()}] tick error:`, (e as Error).message);
    }

    if (MAX_TICKS && tick >= MAX_TICKS) break;
    await sleep(TICK_SECONDS * 1000);
  }

  const flushed = await closeMatured(0);
  if (flushed > 0) console.log(`Flushed ${flushed} open position(s) at exit.`);
  console.log("Agent stopped. Run `npm run autopsy` to analyze.");
}

// Run directly when invoked as a script (npm run agent), but not when imported
const isMain = process.argv[1]?.endsWith("run.ts") || process.argv[1]?.endsWith("run.js");
if (isMain) run();
