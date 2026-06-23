/**
 * LLM-based decision making. This is what turns Glass Box's subject from a
 * rules bot into a real *reasoning* agent — which is the whole point: an LLM
 * that narrates a confident thesis is exactly the thing whose self-deception
 * the autopsy engine is built to expose.
 *
 * Provider-agnostic via an OpenAI-compatible /chat/completions endpoint.
 * Defaults to the hackathon's free Qwen endpoint; set LLM_* to point anywhere
 * (Qwen, Claude via a gateway, OpenAI, a local model, etc.).
 *
 *   LLM_API_KEY   required to enable the LLM agent (else run.ts uses rules)
 *   LLM_BASE_URL  default https://hackathon.bitgetops.com/v1  (Bitget Qwen)
 *   LLM_MODEL     default qwen3.6-plus
 *
 * The model is instructed to map its thinking onto our closed DriverTag set so
 * the engine can aggregate "when you cited X, did X pay off?". Free-text
 * reasons would be unanalyzable — forcing the structured driver IS the trick.
 */
import type { MarketSnapshot, StatedThesis, Side, DriverTag } from "../types.ts";
import type { Decision } from "./strategy.ts";

const DRIVERS: DriverTag[] = [
  "momentum_breakout", "mean_reversion", "trend_follow",
  "sentiment_extreme", "funding_signal", "breakdown_short", "news_catalyst",
];

export function llmEnabled(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

const SYSTEM = `You are an autonomous crypto perpetual-futures trading agent.
Each tick you receive an objective market snapshot and must decide one action.
You MUST respond with a single JSON object and nothing else:

{
  "action": "long" | "short" | "flat",
  "primary_driver": one of [${DRIVERS.join(", ")}],
  "confidence": number between 0 and 1,
  "supporting_signals": string[],   // brief cues you noticed
  "rationale": string               // one sentence, plain English
}

Rules:
- "primary_driver" must be the SINGLE reason you most stand behind for this trade.
- Be honest about confidence: it should reflect real conviction, not bravado.
- If there is no clear setup, return "flat".`;

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

/** Extract the first JSON object from a model response, tolerating code fences. */
function parseJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON in LLM response: ${text.slice(0, 120)}`);
  return JSON.parse(raw.slice(start, end + 1));
}

/** Ask the LLM for a decision. Returns null on "flat". Throws on transport/parse
 *  errors so the caller can fall back to the rules agent for that tick. */
export async function decideLLM(snap: MarketSnapshot): Promise<Decision | null> {
  const baseUrl = process.env.LLM_BASE_URL ?? "https://hackathon.bitgetops.com/v1";
  const model = process.env.LLM_MODEL ?? "qwen3.6-plus";
  const apiKey = process.env.LLM_API_KEY!;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.6,
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

  // Validate / clamp the model's structured output before trusting it.
  const driver: DriverTag = DRIVERS.includes(parsed.primary_driver)
    ? parsed.primary_driver
    : "momentum_breakout";
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
