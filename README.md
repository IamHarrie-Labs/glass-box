# Glass Box

**Glass Box catches AI trading agents lying to themselves.**

Every LLM trading agent writes a confident reason for every trade it makes. Glass Box checks whether that reason is actually true — or just a story the agent told itself.

Live demo → **[useglassbox.vercel.app](https://useglassbox.vercel.app)**

---

## The problem in one sentence

When an AI agent says *"going long — momentum breakout with bullish funding"* and then wins the trade, was it right? Or did it just get lucky because BTC went up that hour? Without Glass Box, you have no way to know. With it, you do.

## What it found on a real agent

We ran Glass Box on 200+ live paper trades and the autopsy was blunt:

- **Self-deception index: 100%** — not one stated reason beat its direction-adjusted baseline
- **The real driver: 24h BTC momentum (corr ~0.70)** — the agent was riding beta and narrating a story
- **Overconfidence gap: ~29 points** — stated confidence ran far above the actual win rate
- **Win rate ~43% after round-trip friction** — every cited reason graded out as decorative

Numbers update live as the agent keeps trading. See the current report at [useglassbox.vercel.app](https://useglassbox.vercel.app) → Report tab.

---

## Try it in 2 minutes (no API keys needed)

```bash
git clone https://github.com/IamHarrie-Labs/glass-box
cd glass-box
npm install
npm run demo
```

Then open `data/report.html` in your browser. The demo runs the full autopsy on a built-in agent log and shows you the verdict — no account, no keys, no network needed.

---

## Run it live (real market data)

### 1. Get a free LLM key

Glass Box works with any OpenAI-compatible LLM. The easiest free option is [Groq](https://console.groq.com) — sign up, create an API key, done.

### 2. Create a `.env` file

Copy `.env.example` to `.env` and fill it in:

```
LLM_API_KEY=your-groq-key-here
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.1-8b-instant

# Loop pacing (keeps you under free-tier rate limits)
TICK_SECONDS=120

# Assets rotated one per tick — prevents single-asset tautologies
SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT

# Round-trip friction (fee + slippage) charged to every close, in bps
FRICTION_BPS=6
```

### 3. Start the agent

```bash
npm run agent
```

The agent fetches live BTC data from Bitget, asks the LLM to reason about it, and logs every decision with its stated thesis before the outcome is known. Leave it running — it writes to `data/trades.jsonl` continuously.

### 4. Run the autopsy

Once you have trades (a few hours is enough to see patterns):

```bash
npm run autopsy
npm run site
```

Open `docs/index.html` to see the full Glass Box site with your live data.

---

## How it works

Glass Box is two things:

**The agent** reads live market data (price, RSI, funding rate, Fear and Greed, volatility) and asks an LLM to decide — long, short, or flat — and explain why. That explanation is locked into the log *before* the position opens. The agent cannot revise its reasoning after seeing whether the trade worked.

**The autopsy engine** runs three analyses once positions close:

| Analysis | Question it answers |
|---|---|
| Signal attribution | Which market feature actually predicted your PnL? |
| Self-deception detection | When you cited each reason, did those trades beat your baseline? |
| Confidence calibration | When you said 90% confident, did you actually win 90%? |

Each stated reason gets a verdict: `real_edge`, `decorative`, or `harmful`.

### What makes the verdicts honest

The self-deception check is built to resist the obvious ways a reason could *look* like an edge without being one:

- **Direction-adjusted baseline.** A driver is not compared against the global win rate. It is compared against the win rate of the *same long/short mix* of trades that did **not** cite it. This stops a label from looking like an edge just because it happened to ride the market's direction.
- **Two-proportion z-test.** A driver only earns `real_edge` or `harmful` when its lift over that baseline is statistically significant, not just numerically different. Thin samples stay `insufficient_data` rather than manufacturing false confidence.
- **Round-trip friction.** Every closed position is charged `FRICTION_BPS` (default 6 bps) of fee + slippage, so PnL and every downstream verdict reflect honest, tradeable results.
- **Multi-asset rotation.** The agent rotates through `SYMBOLS` (BTCUSDT, ETHUSDT, SOLUSDT) one per tick, so the "real driver" finding cannot be a single-asset tautology.
- **Autopsy feedback loop.** After each autopsy, verified findings are injected back into the agent's prompt and any `harmful` driver is removed from its allowed tag set. Decorative drivers are kept on purpose — removing them would collapse the comparison group and invalidate future baselines.

### Driver tags

The LLM must map its reasoning onto a closed enum before each trade — free text cannot be aggregated, a closed set can:

`momentum_breakout` · `mean_reversion` · `trend_follow` · `sentiment_extreme` · `funding_signal` · `breakdown_short` · `news_catalyst`

---

## From verdict to better trading

A report nobody acts on is just a chart. Glass Box closes the loop. When the autopsy runs, it doesn't only grade the agent, it rewires it:

- A driver that grades `harmful` (it actually loses money when cited, confirmed by the z-test) gets pulled from the agent's allowed tags on the next tick. The agent can no longer make that trade. The bleeding stops.
- A driver that grades `real_edge` gets reinforced in the prompt, so the agent leans on what genuinely works.
- A `decorative` driver is kept but labeled, so nobody mistakes a good story for a real signal.

That is how a real trading desk gets better: kill the strategies with no edge, scale the ones that have it. Glass Box just does it with statistical proof instead of gut feel.

And when every driver grades out decorative, like it did on our own agent, the honest verdict is "this agent has no edge yet, don't risk real money on it." Stopping a losing agent before it goes live is not a failure of the tool. It is the point. The losses it prevents are real money saved.

## Why an exchange cares

Glass Box is risk infrastructure, not a signal service. An exchange makes money on volume and retention, and the fastest way to lose both is to let users deploy AI agents that quietly blow up.

- Agents that get audited and pruned survive longer, so users keep trading instead of rage-quitting after a drawdown.
- "Trade with agents you can actually verify" is a trust line no competitor has.
- The Self-Deception Index is the natural ranking metric for an agent marketplace: a credit score for an agent's reasoning honesty.

A desk running ten LLM agents needs to know which one is really reasoning and which is just telling good stories. Glass Box answers that, and the answer is what keeps a platform's traders alive.

---

## Audit your own agent

Glass Box is not just for its built-in agent. Any agent can be audited by logging Decision Records to a JSONL file. The schema is simple:

```json
{
  "tradeId": "t_001",
  "timestamp": "2026-06-23T09:17:09.000Z",
  "pair": "BTCUSDT",
  "side": "long",
  "entryPrice": 62446.5,
  "sizeUsd": 1000,
  "statedThesis": {
    "primaryDriver": "mean_reversion",
    "supportingSignals": ["rsi_oversold"],
    "confidence": 0.70,
    "naturalLanguage": "Market is oversold, expecting a bounce."
  },
  "marketSnapshot": {
    "price": 62446.5,
    "btc1hReturn": -0.007,
    "btc24hReturn": -0.026,
    "rsi14": 12.4,
    "fundingRate": -0.0001,
    "fearGreed": 38,
    "volatility": 0.018
  },
  "outcome": {
    "exitPrice": 63100.0,
    "pnlUsd": 10.47,
    "heldMinutes": 240
  }
}
```

Point the engine at your log:

```bash
GLASSBOX_LOG=path/to/your-agent.jsonl npm run autopsy
```

---

## Commands

| Command | What it does |
|---|---|
| `npm run demo` | Full offline demo — no keys or network needed |
| `npm run agent` | Start the live LLM trading agent |
| `npm run autopsy` | Analyze the trade log, write report.json |
| `npm run site` | Build the full Glass Box site to docs/index.html |
| `npm run report` | Build just the autopsy HTML report |
| `npm run ledger` | Write a running-balance ledger (CSV) from the trade log |

---

## Project structure

```
src/
  agent/
    run.ts        the trading loop
    llm.ts        LLM decision layer (provider-agnostic)
    strategy.ts   rules-based fallback
    paper.ts      paper trade executor
  bitget/
    market.ts     live market data from Bitget public API
  engine/
    autopsy.ts    the three analysis jobs
    stats.ts      correlation + significance helpers
    run.ts        autopsy entry point
  report/
    build.ts      standalone HTML report generator
    site.ts       full multi-page site generator (Poppins UI, SPA routing)
    ledger.ts     running-balance ledger (CSV) derived from the trade log
  persist/
    push.ts       GitHub log sync, 60-min minimum interval
  server.ts       HTTP server + agent (for Render / cloud deployment)
  types.ts        shared types and Decision Record schema
docs/
  index.html      pre-built static site (deployed to Vercel)
  404.html        SPA fallback for direct deep links
  .nojekyll       serve docs/ verbatim on GitHub Pages
data/
  trades.jsonl    append-only paper-trading log (the audit trail)
  report.json     autopsy output (verdicts, correlations, calibration)
  ledger.csv      running-balance ledger with timestamp, pair, side, price, size
```

---

## Deploy your own instance

The agent runs continuously and needs a server. The free stack:

**Render** (runs the agent loop) + **Vercel** (hosts the static site)

How the pieces fit:

- **Render** runs `npm run start`, which trades and periodically syncs `data/*` to GitHub via the Contents API. The push interval is floored at 60 minutes so it never floods a connected deploy host (Vercel free tier caps at 100 deploys/day).
- **The site is static.** `npm run site` bakes the latest data into `docs/index.html`. Publish it to Vercel with a CLI upload — no git connection needed, so data pushes never trigger or throttle deploys:

  ```bash
  npm run site
  vercel deploy --prod --yes --token=<your-vercel-token>
  ```

See the **Docs** page on the live site for the full deployment and configuration guide.

---

Built for **Bitget AI Base Camp Hackathon S1 · Track 2 · Trading Infra**

MIT License
