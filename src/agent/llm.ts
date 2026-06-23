/**
 * LLM-based decision making.
 *
 * On startup, loads data/report.json (if it exists) and:
 *   1. Restricts the driver list to only drivers with verdict "real_edge"
 *   2. Injects a performance feedback block into the system prompt so the
 *      agent knows which of its past reasons were real and which were fiction
 *
 * Provider-agnostic via an OpenAI-compatible /chat/completions endpoint.
 *   LLM_API_KEY   required to enable the LLM agent
 *   LLM_BASE_URL  default https://api.groq.com/openai/v1
 *   LLM_MODEL     default llama-3.1-8b-instant
 */
import { existsSync, readFileSync } from "node:fs";
import type { MarketSnapshot, StatedThesis, Side, DriverTag } from "../types.ts";
import type { Decision } from "./strategy.ts";
import type { AutopsyReport } from "../engine/autopsy.ts";

const ALL_DRIVERS: DriverTag[] = [
  "momentum_breakout", "mean_reversion", "trend_follow",
  "sentiment_extreme", "funding_signal", "breakdown_short", "news_catalyst",
];

// ── load autopsy feedback at startup ────────────────────────────────────────

interface Feedback {
  allowedDrivers: DriverTag[];
  systemBlock: string;
}

function loadFeedback(): Feedback {
  if (!existsSync("data/report.json")) {
    return { allowedDrivers: ALL_DRIVERS, systemBlock: "" };
  }

  let report: AutopsyReport;
  try {
    report = JSON.parse(readFileSync("data/report.json", "utf8"));
  } catch {
    return { allowedDrivers: ALL_DRIVERS, systemBlock: "" };
  }

  const realEdge = report.drivers
    .filter((d) => d.verdict === "real_edge")
    .map((d) => d.driver);

  const harmful = report.drivers
    .filter((d) => d.verdict === "harmful")
    .map((d) => d.driver);

  const decorative = report.drivers
    .filter((d) => d.verdict === "decorative")
    .map((d) => d.driver);

  // Use only proven drivers; fall back to full list if none are proven yet
  const allowedDrivers: DriverTag[] = realEdge.length > 0 ? realEdge : ALL_DRIVERS;

  const topSignal = report.attribution[0];
  const winPct = (report.overallWinRate * 100).toFixed(0);
  const confGapPct = (report.overconfidenceGap * 100).toFixed(0);

  const lines: string[] = [
    "",
    "YOUR VERIFIED PERFORMANCE HISTORY:",
    `- Analyzed ${report.totalTrades} closed trades. Overall win rate: ${winPct}%.`,
    `- Real PnL driver: "${topSignal.feature}" (correlation ${topSignal.correlationWithPnl.toFixed(2)}).`,
    `  Weight this market feature heavily when deciding direction.`,
  ];

  if (harmful.length > 0) {
    lines.push(`- HARMFUL reasons you cited that made your win rate DROP: ${harmful.join(", ")}.`);
    lines.push(`  Do NOT use these as your primary_driver — they predict losses.`);
  }

  if (decorative.length > 0) {
    lines.push(`- Decorative reasons that showed no real edge: ${decorative.join(", ")}.`);
    lines.push(`  Avoid citing these unless you have genuinely new evidence.`);
  }

  if (Number(confGapPct) > 5) {
    lines.push(`- Overconfidence gap: ${confGapPct}pp. Your actual results were ${confGapPct}pp worse than your stated confidence.`);
    lines.push(`  Calibrate downward — say 0.55 when you mean 0.7.`);
  }

  lines.push(`- Only use drivers that have a proven edge. If the market does not match one of your allowed drivers, return flat.`);

  return {
    allowedDrivers,
    systemBlock: lines.join("\n"),
  };
}

const { allowedDrivers: DRIVERS, systemBlock: FEEDBACK } = loadFeedback();

if (FEEDBACK) {
  console.log(`[llm] Autopsy feedback loaded. Allowed drivers: ${DRIVERS.join(", ")}`);
} else {
  console.log(`[llm] No autopsy data yet — using all drivers.`);
}

// ── system prompt ────────────────────────────────────────────────────────────

function buildSystem(): string {
  return `You are an autonomous crypto perpetual-futures trading agent.
Each tick you receive an objective market snapshot and must decide one action.
You MUST respond with a single JSON object and nothing else:

{
  "action": "long" | "short" | "flat",
  "primary_driver": one of [${DRIVERS.join(", ")}],
  "confidence": number between 0 and 1,
  "supporting_signals": string[],
  "rationale": string
}

Rules:
- "primary_driver" MUST be one of the allowed drivers listed above. No others are accepted.
- Be honest about confidence: reflect real conviction, not bravado.
- If the market does not clearly match one of your allowed drivers, return "flat".
- "rationale" must be one honest sentence. Do not invent reasons that are not in the data.${FEEDBACK}`;
}

const SYSTEM = buildSystem();

// ── user prompt ──────────────────────────────────────────────────────────────

function buildUserPrompt(snap: MarketSnapshot): string {
  return `Market snapshot (BTCUSDT perpetual):
- price: ${snap.price.toFixed(1)}
- BTC 1h return: ${(snap.btc1hReturn * 100).toFixed(2)}%
- BTC 24h return: ${(snap.btc24hReturn * 100).toFixed(2)}%
- RSI(14): ${snap.rsi14.toFixed(1)}
- funding rate: ${(snap.fundingRate * 100).toFixed(4)}%
- Fear & Greed: ${snap.fearGreed.toFixed(0)}/100
- realized volatility (1h): ${(snap.volatility * 100).toFixed(2)}%

Decide your action now. Respond with JSON only.`;
}

// ── helpers ──────────────────────────────────────────────────────────────────

export function llmEnabled(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

function parseJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON in LLM response: ${text.slice(0, 120)}`);
  return JSON.parse(raw.slice(start, end + 1));
}

// ── main decision function ───────────────────────────────────────────────────

export async function decideLLM(snap: MarketSnapshot): Promise<Decision | null> {
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
  const model = process.env.LLM_MODEL ?? "llama-3.1-8b-instant";
  const apiKey = process.env.LLM_API_KEY!;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUserPrompt(snap) },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseJson(content);

  if (parsed.action === "flat" || (parsed.action !== "long" && parsed.action !== "short")) {
    return null;
  }

  // Only accept drivers from the verified allowed list
  const driver: DriverTag = DRIVERS.includes(parsed.primary_driver)
    ? parsed.primary_driver
    : DRIVERS[0];

  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5));

  const thesis: StatedThesis = {
    primaryDriver: driver,
    supportingSignals: Array.isArray(parsed.supporting_signals)
      ? parsed.supporting_signals.slice(0, 5).map(String)
      : [],
    confidence: Number(confidence.toFixed(2)),
    naturalLanguage: String(parsed.rationale ?? "").slice(0, 240),
  };

  return { side: parsed.action as Side, thesis };
}
