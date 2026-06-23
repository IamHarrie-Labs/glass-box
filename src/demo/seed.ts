/**
 * Demo seeder — generates a realistic trade log so the autopsy engine has
 * something to chew on WITHOUT needing Bitget API keys or waiting days for a
 * live agent. Run by `npm run demo`.
 *
 * The data is engineered to tell one specific, true-to-life story:
 *
 *   The agent THINKS it is a momentum-breakout trader. It cites
 *   "momentum_breakout" on most trades, often with high confidence.
 *   In reality, its PnL is driven almost entirely by btc24hReturn — it just
 *   makes money when BTC happened to be going up, and loses when it wasn't.
 *   Its stated reason is decorative. Its confidence is uncalibrated.
 *
 * This is the single most common failure mode of real LLM traders, and the
 * engine's job is to catch it. The seed is deterministic (fixed RNG) so the
 * demo tells the same story every run.
 */
import { appendRecord, rewriteRecords } from "../store.ts";
import type { DecisionRecord, DriverTag, MarketSnapshot } from "../types.ts";

// --- tiny deterministic RNG so the demo is reproducible -------------------
let seed = 1337;
function rand(): number {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randn(): number {
  // Box–Muller
  return Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const DRIVERS_THE_AGENT_LIKES: DriverTag[] = [
  "momentum_breakout", // cited most — the "story"
  "momentum_breakout",
  "momentum_breakout",
  "trend_follow",
  "funding_signal",
];

const N_TRADES = 120;
const START = Date.parse("2026-06-15T00:00:00Z");

function makeSnapshot(): MarketSnapshot {
  // btc24hReturn is the TRUE driver. Centered near zero, both directions.
  const btc24hReturn = randn() * 0.03;
  return {
    price: 64000 + randn() * 1500,
    btc1hReturn: btc24hReturn * 0.3 + randn() * 0.01,
    btc24hReturn,
    rsi14: 50 + randn() * 15,
    fundingRate: randn() * 0.0008,
    fearGreed: Math.max(0, Math.min(100, 55 + randn() * 18)),
    volatility: Math.abs(randn()) * 0.02 + 0.01,
  };
}

const records: DecisionRecord[] = [];

for (let i = 0; i < N_TRADES; i++) {
  const snap = makeSnapshot();

  // The agent almost always goes long and almost always blames "momentum".
  const side = rand() < 0.85 ? "long" : "short";
  const primaryDriver = pick(DRIVERS_THE_AGENT_LIKES);

  // Confidence is HIGH and basically random w.r.t. reality (uncalibrated).
  const confidence = 0.55 + rand() * 0.4;

  // --- the truth model ---------------------------------------------------
  // PnL is driven by btc24hReturn aligned with the side, plus noise.
  // The stated driver contributes ~nothing. This is the deception.
  const directional = side === "long" ? snap.btc24hReturn : -snap.btc24hReturn;
  const pnlPct = directional * 0.9 + randn() * 0.012; // mostly beta, some noise
  const sizeUsd = 1000;
  const pnlUsd = pnlPct * sizeUsd;
  const entryPrice = snap.price;
  const exitPrice = entryPrice * (1 + (side === "long" ? pnlPct : -pnlPct));

  records.push({
    tradeId: `t_${String(i).padStart(4, "0")}`,
    timestamp: new Date(START + i * 3600_000).toISOString(),
    pair: "BTCUSDT",
    side,
    entryPrice,
    sizeUsd,
    statedThesis: {
      primaryDriver,
      supportingSignals: ["range_break", "volume_uptick"].slice(0, 1 + Math.floor(rand() * 2)),
      confidence: Number(confidence.toFixed(2)),
      naturalLanguage:
        primaryDriver === "momentum_breakout"
          ? "Price cleared the 4h range on rising volume; expecting continuation."
          : "Trend and positioning support staying with the move.",
    },
    marketSnapshot: snap,
    outcome: {
      exitPrice: Number(exitPrice.toFixed(2)),
      pnlUsd: Number(pnlUsd.toFixed(2)),
      pnlPct: Number(pnlPct.toFixed(4)),
      heldMinutes: 60 + Math.floor(rand() * 360),
      win: pnlUsd > 0,
    },
  });
}

// Fresh log each demo run.
rewriteRecords([]);
for (const r of records) appendRecord(r);

const wins = records.filter((r) => r.outcome!.win).length;
console.log(`Seeded ${records.length} trades -> data/trades.jsonl`);
console.log(`Overall win rate: ${((wins / records.length) * 100).toFixed(1)}%`);
console.log(`Next: npm run autopsy`);
