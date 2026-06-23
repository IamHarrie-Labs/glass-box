/**
 * Glass Box — core data contract.
 *
 * The Decision Record is the spine of the whole system. The agent WRITES it
 * (one per trade), the autopsy engine READS it. The single most important
 * design rule lives here:
 *
 *   `statedThesis` is captured at ENTRY, before the outcome is known.
 *   `marketSnapshot` records what was OBJECTIVELY true at that same instant.
 *
 * The engine's entire job is to compare those two: did the reason the agent
 * GAVE (statedThesis) actually line up with what the market DID
 * (marketSnapshot -> outcome)? The gap between them is "self-deception", and
 * measuring it is the product.
 */

/** The catalog of reasons an agent is allowed to cite. Closed set on purpose:
 *  free-text reasons can't be aggregated. The agent must map its thinking onto
 *  one primary driver so the engine can ask "when you cited X, did X pay off?". */
export type DriverTag =
  | "momentum_breakout"   // price breaking a range / trend continuation
  | "mean_reversion"      // fade an overextended move back to the mean
  | "trend_follow"        // ride an established directional trend
  | "sentiment_extreme"   // act on fear/greed or crowd positioning extremes
  | "funding_signal"      // perp funding rate implies crowded/squeezed side
  | "breakdown_short"     // price losing support / bearish continuation
  | "news_catalyst";      // a discrete headline/event drives the entry

export type Side = "long" | "short";

/** What the agent CLAIMS is happening. Natural language is kept for the demo,
 *  but the engine only does math on the structured fields. */
export interface StatedThesis {
  primaryDriver: DriverTag;          // the one reason the agent stands behind
  supportingSignals: string[];       // secondary cues it noticed (free-form, for color)
  confidence: number;                // 0..1 — used later for calibration analysis
  naturalLanguage: string;           // the human-readable rationale (demo gold)
}

/** What was OBJECTIVELY true at the moment of entry. These are plain numbers
 *  pulled from market data / Bitget skills — no opinion, no narrative. The
 *  engine correlates THESE against PnL to find the real driver. */
export interface MarketSnapshot {
  price: number;
  btc1hReturn: number;     // recent short-term momentum of BTC (the market's beta)
  btc24hReturn: number;    // broader daily drift — the usual "hidden driver"
  rsi14: number;           // 0..100 momentum oscillator
  fundingRate: number;     // perp funding at entry (crowding proxy)
  fearGreed: number;       // 0..100 sentiment index
  volatility: number;      // recent realized vol (regime proxy)
}

/** Filled in LATER, once the position is closed. Null until then. */
export interface Outcome {
  exitPrice: number;
  pnlUsd: number;          // realized profit/loss in USD (sim)
  pnlPct: number;          // return on the position
  heldMinutes: number;
  win: boolean;            // pnlUsd > 0
}

/** One trade, fully described: the claim, the reality, and the result. */
export interface DecisionRecord {
  tradeId: string;
  timestamp: string;       // ISO 8601, entry time
  pair: string;            // e.g. "BTCUSDT"
  side: Side;
  entryPrice: number;
  sizeUsd: number;
  statedThesis: StatedThesis;
  marketSnapshot: MarketSnapshot;
  outcome: Outcome | null; // null while position is open
}

/** The numeric feature keys the engine attributes PnL against. Keep in sync
 *  with MarketSnapshot's numeric fields — this is the list the engine loops over. */
export const SNAPSHOT_FEATURES: (keyof MarketSnapshot)[] = [
  "btc1hReturn",
  "btc24hReturn",
  "rsi14",
  "fundingRate",
  "fearGreed",
  "volatility",
];
