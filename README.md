# Glass Box 🔍

**An audit layer that measures the gap between what an AI trading agent _says_ and what actually drove its PnL.**

Bitget AI Base Camp Hackathon S1 · Track 2 (Trading Infra)

---

## The thesis

Every LLM trading agent narrates its trades: _"going long BTC — momentum breakout with bullish funding."_ Nobody checks whether that stated reason is what actually made money.

Usually it isn't. The most common silent failure of LLM traders is **self-deception**: the agent cites a sophisticated-sounding reason while its PnL is really just BTC beta — it makes money when the market goes up and loses when it doesn't, no matter what it claims.

Glass Box catches this. It records each agent decision's **stated thesis at entry, before the outcome is known**, then after outcomes resolve it statistically tests whether the stated reason actually predicted the result — or was decorative narration. That gap is something only an LLM-era tool needs to measure, because only LLM agents produce natural-language reasons.

## What it does

Given a trade log, the autopsy engine answers three questions:

1. **Attribution** — Which _objective_ market feature actually moved with PnL? (correlation)
2. **Self-deception** — For each reason the agent cited, did citing it beat its baseline, or is it just a story? (`real_edge` / `decorative` / `harmful`)
3. **Calibration** — When the agent was confident, did it actually win more? (overconfidence gap)

It outputs a terminal report, a structured `report.json`, and a self-contained `report.html`.

## Quick start (no keys needed)

```bash
npm install
npm run demo      # seed a realistic agent log, run the autopsy, build the report
```

Then open `data/report.html`. The bundled demo agent _thinks_ it trades momentum breakouts; the autopsy reveals its PnL is 0.90-correlated with `btc24hReturn` and its favorite reason is **decorative** — and that at 90%+ confidence it won only 27% of the time.

## Run the live agent (real Bitget data)

The agent perceives **live Bitget market data** (public v2 API — candles, ticker, funding rate; no secret keys required for paper trading), decides, and paper-trades. Positions open at the real price and close at the real later price, so PnL reflects genuine market movement.

```bash
npm run agent     # continuous: 1h ticks, 4h holds, streams to data/trades.jsonl
```

Configure via env:

| Var | Default | Meaning |
|---|---|---|
| `SYMBOL` | `BTCUSDT` | trading pair |
| `TICK_SECONDS` | `3600` | seconds between decisions |
| `HOLD_MINUTES` | `240` | how long each paper position is held |
| `MAX_TICKS` | `0` | stop after N ticks (0 = run forever) |

Fast live smoke test (opens + closes within ~1 minute):

```bash
TICK_SECONDS=10 HOLD_MINUTES=0.3 MAX_TICKS=6 npm run agent
npm run autopsy && npm run report
```

### LLM brain (recommended — makes the autopsy meaningful)

By default the agent uses simple rules. Set `LLM_API_KEY` and it instead asks a
language model to read the snapshot and produce a structured thesis — an actual
*reasoning* agent, whose self-deception is what Glass Box exists to measure. On
any model error it falls back to rules for that tick, so the loop never stalls.

Defaults to the hackathon's free Qwen endpoint:

```bash
export LLM_API_KEY=...                              # your Bitget Qwen key
# optional overrides:
# export LLM_BASE_URL=https://hackathon.bitgetops.com/v1   (default)
# export LLM_MODEL=qwen3.6-plus                            (default)
npm run agent
```

Point `LLM_BASE_URL` / `LLM_MODEL` at any OpenAI-compatible endpoint to swap models.

> **Network note:** `api.bitget.com` rate-limits / geo-blocks some datacenter IPs. If you see repeated timeouts, run from a Bitget-served region or via VPN. The `npm run demo` path works fully offline.

### Authenticated trading (optional)

Paper trading needs no keys. For live execution via the Bitget Agent Hub MCP server:

```bash
export BITGET_API_KEY=...
export BITGET_SECRET_KEY=...
export BITGET_PASSPHRASE=...
npx bitget-hub install --target claude   # or codex/cursor
```

Glass Box's design is execution-agnostic: swap `openPosition()` in `src/agent/paper.ts` for a real order call and everything else is unchanged.

## Audit _any_ agent (the infra story)

Glass Box doesn't only analyze its own agent. Any trader — yours, a Bitget Playbook strategy, anything — can be audited by emitting **Decision Records** (the schema in `src/types.ts`) to a JSONL file and pointing the engine at it:

```bash
GLASSBOX_LOG=path/to/your-agent.jsonl npm run autopsy
```

The only contract: log `statedThesis` + `marketSnapshot` at entry, backfill `outcome` at exit. See `src/types.ts` for the full schema.

## How it works

```
Bitget live data ──▶ Agent (decides + logs stated thesis) ──▶ trades.jsonl
                                                                   │
                                              outcome backfilled at exit
                                                                   ▼
                                       Autopsy Engine ──▶ report.json / report.html
```

| Path | Role |
|---|---|
| `src/types.ts` | Decision Record schema — the data contract everything shares |
| `src/bitget/market.ts` | Live Bitget perception → `MarketSnapshot` |
| `src/agent/strategy.ts` | The (deliberately naive) decision logic |
| `src/agent/paper.ts` | Paper executor + outcome backfill |
| `src/engine/autopsy.ts` | The three analysis jobs — the product |
| `src/report/build.ts` | HTML report renderer |

## Why "deliberately naive" agent?

The agent isn't trying to win on alpha — it's a realistic _subject_ for the audit. A naive momentum-chaser that quietly rides beta while narrating confident theses is exactly the agent Glass Box exists to expose. The point isn't a profitable bot; it's a tool that tells any agent the truth about itself.

## License

MIT
