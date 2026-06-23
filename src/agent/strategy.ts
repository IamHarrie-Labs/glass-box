/**
 * The agent's brain — DELIBERATELY simple and a little overconfident.
 *
 * This is not where we try to win on alpha. The agent's job is to make
 * plausible, honestly-logged decisions so the autopsy engine has a real
 * subject to dissect. A naive momentum-chaser is exactly the kind of agent
 * that quietly rides BTC beta while telling itself it has an edge — which is
 * the story Glass Box exists to expose.
 *
 * Swappable: replace `decide()` with an LLM call (e.g. Bitget Agent Hub's
 * skill outputs fed to a model) and the rest of the system is unchanged, as
 * long as it returns a StatedThesis + side.
 */
import type { MarketSnapshot, StatedThesis, Side, DriverTag } from "../types.ts";

export interface Decision {
  side: Side;
  thesis: StatedThesis;
}

/** Map the snapshot to a trade. Naive rules, confident narration. */
export function decide(snap: MarketSnapshot): Decision | null {
  const { rsi14, btc1hReturn, fundingRate, fearGreed } = snap;

  let side: Side | null = null;
  let primaryDriver: DriverTag = "momentum_breakout";
  const supporting: string[] = [];

  // Momentum chaser: recent up-move + RSI not yet "overbought" => long.
  if (btc1hReturn > 0.0015 && rsi14 < 72) {
    side = "long";
    primaryDriver = "momentum_breakout";
    supporting.push("1h_uptick");
  } else if (btc1hReturn < -0.0015 && rsi14 > 28) {
    side = "short";
    primaryDriver = "breakdown_short";
    supporting.push("1h_downtick");
  } else if (rsi14 > 70) {
    side = "short";
    primaryDriver = "mean_reversion";
    supporting.push("rsi_overbought");
  } else if (rsi14 < 30) {
    side = "long";
    primaryDriver = "mean_reversion";
    supporting.push("rsi_oversold");
  } else {
    return null; // no trade this tick
  }

  // Secondary cues it "notices" (color for the log, no real effect).
  if (Math.abs(fundingRate) > 0.0003) supporting.push("funding_skew");
  if (fearGreed > 70) supporting.push("greedy_tape");
  if (fearGreed < 30) supporting.push("fearful_tape");

  // Confidence: scaled by how strong the move looks. Intentionally generous —
  // the agent believes in itself more than it should. The engine will catch it.
  const strength = Math.min(1, Math.abs(btc1hReturn) / 0.004);
  const confidence = Number((0.55 + strength * 0.4).toFixed(2));

  const naturalLanguage =
    side === "long"
      ? `Buying ${primaryDriver.replace("_", " ")}: 1h momentum ${(btc1hReturn * 100).toFixed(2)}%, RSI ${rsi14.toFixed(0)}. Expecting continuation.`
      : `Selling ${primaryDriver.replace("_", " ")}: 1h momentum ${(btc1hReturn * 100).toFixed(2)}%, RSI ${rsi14.toFixed(0)}. Expecting fade.`;

  return {
    side,
    thesis: { primaryDriver, supportingSignals: supporting, confidence, naturalLanguage },
  };
}
