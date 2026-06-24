/**
 * Paper-trading executor. No real orders are placed — we open a position at
 * the live Bitget price, then close it later at a *real* later Bitget price.
 * The PnL is therefore driven by genuine market movement, which is what makes
 * the autopsy meaningful (and the log a legitimate paper-trading record).
 */
import { randomUUID } from "node:crypto";
import type { DecisionRecord, MarketSnapshot, StatedThesis, Side } from "../types.ts";
import { appendRecord, loadRecords, rewriteRecords } from "../store.ts";
import { fetchPrice } from "../bitget/market.ts";

const SIZE_USD = 1000;
// Round-trip trading friction (taker fee + slippage), in basis points of notional.
// Charged once per closed position so paper PnL isn't fantasy-frictionless.
// Override with FRICTION_BPS; 6 bps ≈ Bitget taker fee + a little slippage.
const FRICTION_BPS = Number(process.env.FRICTION_BPS ?? 6);

/** Open a paper position and persist the Decision Record (outcome = null). */
export function openPosition(
  pair: string,
  side: Side,
  snapshot: MarketSnapshot,
  thesis: StatedThesis
): DecisionRecord {
  const rec: DecisionRecord = {
    tradeId: `t_${randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    pair,
    side,
    entryPrice: snapshot.price,
    sizeUsd: SIZE_USD,
    statedThesis: thesis,
    marketSnapshot: snapshot,
    outcome: null,
  };
  appendRecord(rec);
  return rec;
}

/**
 * Close any open position whose hold window has elapsed, using the current
 * live price. Returns how many were closed.
 */
export async function closeMatured(holdMinutes: number): Promise<number> {
  const records = loadRecords();
  const now = Date.now();
  const friction = FRICTION_BPS / 10000; // bps -> fraction of notional
  let closed = 0;

  // Fetch each pair's exit price at most once per call, not once per position.
  const priceCache = new Map<string, number>();
  const priceFor = async (pair: string) => {
    if (!priceCache.has(pair)) priceCache.set(pair, await fetchPrice(pair));
    return priceCache.get(pair)!;
  };

  for (const r of records) {
    if (r.outcome !== null) continue;
    const ageMin = (now - Date.parse(r.timestamp)) / 60000;
    if (ageMin < holdMinutes) continue;

    const exitPrice = await priceFor(r.pair);
    const dir = r.side === "long" ? 1 : -1;
    const grossPct = (dir * (exitPrice - r.entryPrice)) / r.entryPrice;
    const pnlPct = grossPct - friction; // subtract round-trip cost
    const pnlUsd = pnlPct * r.sizeUsd;
    r.outcome = {
      exitPrice,
      pnlUsd: Number(pnlUsd.toFixed(2)),
      pnlPct: Number(pnlPct.toFixed(4)),
      heldMinutes: Math.round(ageMin),
      win: pnlUsd > 0,
    };
    closed++;
  }

  if (closed > 0) rewriteRecords(records);
  return closed;
}

export function openCount(): number {
  return loadRecords().filter((r) => r.outcome === null).length;
}
