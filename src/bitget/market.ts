/**
 * Live market perception via Bitget's PUBLIC v2 API (no secret keys needed —
 * these are the same data the Agent Hub skills sit on top of). We turn raw
 * candles/ticker/funding into the objective MarketSnapshot the agent reasons
 * over and the engine later attributes PnL against.
 *
 * For PAPER trading we never place real orders, so public market data is all
 * we need. The authenticated trade path (bitget-mcp-server) is documented in
 * the README for teams who want live execution.
 */
import type { MarketSnapshot } from "../types.ts";

const BASE = "https://api.bitget.com";

async function getJson(url: string, retries = 3): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(`Bitget HTTP ${r.status} for ${url}`);
      const j = await r.json();
      if (j.code !== "00000") throw new Error(`Bitget code ${j.code}: ${j.msg}`);
      return j.data;
    } catch (e) {
      lastErr = e;
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error(
    `Bitget request failed after ${retries} tries (${url}). Last error: ${(lastErr as Error)?.message}`
  );
}

/** Classic 14-period RSI from a series of closes. */
function rsi14(closes: number[]): number {
  const period = 14;
  if (closes.length < period + 1) return 50;
  let gain = 0, loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  const rs = loss === 0 ? 100 : gain / loss;
  return 100 - 100 / (1 + rs);
}

/** Realized volatility: stdev of 1h log returns over the window. */
function realizedVol(closes: number[]): number {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  if (rets.length < 2) return 0.01;
  const m = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((a, b) => a + (b - m) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(v);
}

/** Crypto Fear & Greed (alternative.me, free, no key). Falls back to neutral. */
async function fetchFearGreed(): Promise<number> {
  try {
    const r = await fetch("https://api.alternative.me/fng/?limit=1");
    const j = await r.json();
    return Number(j.data?.[0]?.value ?? 50);
  } catch {
    return 50;
  }
}

export interface LiveTick {
  pair: string;
  snapshot: MarketSnapshot;
}

/** Build a full MarketSnapshot for a symbol from live Bitget data. */
export async function fetchSnapshot(symbol = "BTCUSDT"): Promise<LiveTick> {
  const pt = "usdt-futures";
  // 1h candles, newest last. Each row: [ts, open, high, low, close, baseVol, quoteVol]
  const candles: string[][] = await getJson(
    `${BASE}/api/v2/mix/market/candles?symbol=${symbol}&productType=${pt}&granularity=1H&limit=48`
  );
  const closes = candles.map((c) => Number(c[4]));
  const price = closes[closes.length - 1];

  const tickers = await getJson(
    `${BASE}/api/v2/spot/market/tickers?symbol=${symbol}`
  );

  const fundingData = await getJson(
    `${BASE}/api/v2/mix/market/current-fund-rate?symbol=${symbol}&productType=${pt}`
  );
  const fundingRate = Number(fundingData[0]?.fundingRate ?? 0);

  const fearGreed = await fetchFearGreed();

  const c1hAgo  = closes[closes.length - 2] ?? price;
  const c24hAgo = closes[closes.length - 25] ?? closes[0];

  const snapshot: MarketSnapshot = {
    price,
    btc1hReturn:  (price - c1hAgo)  / c1hAgo,
    btc24hReturn: (price - c24hAgo) / c24hAgo,
    rsi14:        rsi14(closes),
    fundingRate,
    fearGreed,
    volatility:   realizedVol(closes),
  };

  return { pair: symbol, snapshot };
}

/** Just the latest price — used to close paper positions. */
export async function fetchPrice(symbol = "BTCUSDT"): Promise<number> {
  const tickers = await getJson(`${BASE}/api/v2/spot/market/tickers?symbol=${symbol}`);
  return Number(tickers[0].lastPr);
}
