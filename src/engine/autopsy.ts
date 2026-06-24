/**
 * The autopsy engine — the actual product.
 *
 * Given a set of CLOSED Decision Records, it answers three questions:
 *
 *   Job 1 — Attribution:  Which objective market feature actually moved with PnL?
 *   Job 2 — Self-deception: For each reason the agent cited, did citing it pay off,
 *                           or is it just a story?
 *   Job 3 — Calibration:  When the agent was confident, did it win more?
 *
 * The output is a structured report object. Rendering lives elsewhere.
 */
import type { DecisionRecord, DriverTag } from "../types.ts";
import { SNAPSHOT_FEATURES } from "../types.ts";
import { mean, pearson, twoProportionZ } from "./stats.ts";

export interface FeatureAttribution {
  feature: string;
  correlationWithPnl: number; // -1..1
}

export interface DriverVerdict {
  driver: DriverTag;
  timesCited: number;
  longCited: number;          // how many of those citations were longs
  shortCited: number;         // …and shorts (exposes directional confounding)
  winRateWhenCited: number;   // 0..1
  baselineWinRate: number;    // DIRECTION-ADJUSTED: what the same long/short mix
                              // of OTHER trades won. Controls for "this label was
                              // just used while the market happened to rise".
  edge: number;               // winRateWhenCited - baselineWinRate
  tStat: number;              // two-proportion z for the cited-vs-rest difference
  verdict: "real_edge" | "decorative" | "harmful" | "insufficient_data";
  sampleRationale?: string;   // one real quote from the agent's natural language
}

export interface CalibrationBucket {
  label: string;              // e.g. "0.8-1.0"
  trades: number;
  avgConfidence: number;
  actualWinRate: number;
  gap: number;                // avgConfidence - actualWinRate (overconfidence > 0)
}

export interface AutopsyReport {
  totalTrades: number;
  overallWinRate: number;
  totalPnlUsd: number;
  assets: string[];                         // distinct pairs in the log
  attribution: FeatureAttribution[];        // sorted by |corr| desc
  hiddenDriver: FeatureAttribution;         // the strongest real driver
  drivers: DriverVerdict[];
  selfDeceptionIndex: number;               // 0..1, share of citations that are decorative/harmful
  calibration: CalibrationBucket[];
  overconfidenceGap: number;                // avg(confidence) - overall win rate
  effectiveSampleNote: string;              // honest caveat about overlapping windows
  headline: string;                         // one-line plain-English verdict
}

function classify(edge: number, tStat: number, n: number): DriverVerdict["verdict"] {
  if (n < 8) return "insufficient_data";
  if (edge > 0.07 && Math.abs(tStat) > 1.5) return "real_edge";
  if (edge < -0.07 && Math.abs(tStat) > 1.5) return "harmful";
  return "decorative";
}

export function runAutopsy(records: DecisionRecord[]): AutopsyReport {
  const closed = records.filter((r) => r.outcome !== null);
  const pnls = closed.map((r) => r.outcome!.pnlUsd);
  const wins = closed.map((r) => (r.outcome!.win ? 1 : 0));
  const overallWinRate = mean(wins);
  const totalPnlUsd = pnls.reduce((a, b) => a + b, 0);

  // --- Job 1: attribution ------------------------------------------------
  const attribution: FeatureAttribution[] = SNAPSHOT_FEATURES.map((f) => {
    // Sign the feature by trade side so "feature helped this position" is
    // comparable across longs and shorts.
    const xs = closed.map((r) => {
      const v = r.marketSnapshot[f] as number;
      return r.side === "long" ? v : -v;
    });
    return { feature: f, correlationWithPnl: pearson(xs, pnls) };
  }).sort((a, b) => Math.abs(b.correlationWithPnl) - Math.abs(a.correlationWithPnl));

  const hiddenDriver = attribution[0];

  // --- Job 2: self-deception per stated driver ---------------------------
  // The baseline is DIRECTION-ADJUSTED: a driver cited mostly on longs is judged
  // against what other longs won, not against the whole book. This stops a label
  // from looking like an "edge" just because it rode the market's direction.
  const win = (r: DecisionRecord) => (r.outcome!.win ? 1 : 0);
  const driverTags = [...new Set(closed.map((r) => r.statedThesis.primaryDriver))];
  const drivers: DriverVerdict[] = driverTags.map((d) => {
    const cited = closed.filter((r) => r.statedThesis.primaryDriver === d);
    const others = closed.filter((r) => r.statedThesis.primaryDriver !== d);

    const longCited = cited.filter((r) => r.side === "long").length;
    const shortCited = cited.filter((r) => r.side === "short").length;
    const winRateWhenCited = mean(cited.map(win));

    // Same-side win rates among OTHER trades, with graceful fallbacks so a sole
    // surviving driver never collapses the baseline to 0 (the old bug).
    const otherLong = others.filter((r) => r.side === "long");
    const otherShort = others.filter((r) => r.side === "short");
    const baseLong = otherLong.length ? mean(otherLong.map(win)) : overallWinRate;
    const baseShort = otherShort.length ? mean(otherShort.map(win)) : overallWinRate;
    const baselineWinRate = cited.length
      ? (longCited * baseLong + shortCited * baseShort) / cited.length
      : overallWinRate;

    const edge = winRateWhenCited - baselineWinRate;
    const { z } = twoProportionZ(cited.map(win), others.map(win));
    const sample = cited.find((r) => r.statedThesis.naturalLanguage);
    return {
      driver: d,
      timesCited: cited.length,
      longCited,
      shortCited,
      winRateWhenCited,
      baselineWinRate,
      edge,
      tStat: z,
      verdict: classify(edge, z, cited.length),
      sampleRationale: sample?.statedThesis.naturalLanguage,
    };
  }).sort((a, b) => b.timesCited - a.timesCited);

  // Share of all citations that turned out decorative or harmful.
  const totalCitations = drivers.reduce((a, d) => a + d.timesCited, 0);
  const wastedCitations = drivers
    .filter((d) => d.verdict === "decorative" || d.verdict === "harmful")
    .reduce((a, d) => a + d.timesCited, 0);
  const selfDeceptionIndex = totalCitations === 0 ? 0 : wastedCitations / totalCitations;

  // --- Job 3: confidence calibration -------------------------------------
  const buckets: [number, number, string][] = [
    [0.0, 0.6, "0.0-0.6"],
    [0.6, 0.75, "0.6-0.75"],
    [0.75, 0.9, "0.75-0.9"],
    [0.9, 1.01, "0.9-1.0"],
  ];
  const calibration: CalibrationBucket[] = buckets
    .map(([lo, hi, label]) => {
      const inB = closed.filter(
        (r) => r.statedThesis.confidence >= lo && r.statedThesis.confidence < hi
      );
      const avgConfidence = mean(inB.map((r) => r.statedThesis.confidence));
      const actualWinRate = mean(inB.map((r) => (r.outcome!.win ? 1 : 0)));
      return {
        label,
        trades: inB.length,
        avgConfidence,
        actualWinRate,
        gap: avgConfidence - actualWinRate,
      };
    })
    .filter((b) => b.trades > 0);

  const overconfidenceGap =
    mean(closed.map((r) => r.statedThesis.confidence)) - overallWinRate;

  // --- honesty caveat about effective sample size ------------------------
  // Trades on the same asset open minutes apart and are held for hours, so their
  // holding windows overlap heavily — their outcomes are NOT independent. We say
  // so out loud rather than overstate significance.
  const assets = [...new Set(closed.map((r) => r.pair))];
  const effectiveSampleNote =
    `These ${closed.length} trades span ${assets.length} asset(s) with overlapping holding ` +
    `windows, so they are not fully independent observations — read the significance ` +
    `(z-scores) as directional, not as hard p-values.`;

  // --- headline ----------------------------------------------------------
  const topDriver = drivers[0];
  let headline: string;
  if (topDriver && topDriver.verdict !== "real_edge" && topDriver.timesCited >= 8) {
    headline =
      `The agent's most-cited reason "${topDriver.driver}" is ${topDriver.verdict} ` +
      `(${(topDriver.winRateWhenCited * 100).toFixed(0)}% win vs ${(topDriver.baselineWinRate * 100).toFixed(0)}% baseline). ` +
      `Its PnL is really driven by "${hiddenDriver.feature}" (corr ${hiddenDriver.correlationWithPnl.toFixed(2)}).`;
  } else {
    headline =
      `Top real driver of PnL: "${hiddenDriver.feature}" ` +
      `(corr ${hiddenDriver.correlationWithPnl.toFixed(2)}).`;
  }

  return {
    totalTrades: closed.length,
    overallWinRate,
    totalPnlUsd,
    assets,
    attribution,
    hiddenDriver,
    drivers,
    selfDeceptionIndex,
    calibration,
    overconfidenceGap,
    effectiveSampleNote,
    headline,
  };
}
