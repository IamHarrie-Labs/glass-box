# Glass Box

**Glass Box catches AI trading agents lying to themselves.**

Every LLM trading agent writes a confident reason for every trade it makes. Glass Box checks whether that reason is actually true — or just a story the agent told itself.

Live demo → **[tryglassbox.vercel.app](https://tryglassbox.vercel.app)**

---

## The problem in one sentence

When an AI agent says *"going long — momentum breakout with bullish funding"* and then wins the trade, was it right? Or did it just get lucky because BTC went up that hour? Without Glass Box, you have no way to know. With it, you do.

## What it found on a real agent

We ran Glass Box on 202 live paper trades and the autopsy was brutal:

- **Self-deception index: 100%** — not one stated reason was a genuine edge
- **mean_reversion was actively harmful** — when the agent cited it, win rate dropped from 45% to 25%
- **At 90%+ confidence, it won only 19% of the time** — high confidence was a negative signal
- **The real driver: 24h BTC momentum (corr 0.77)** — the agent was riding beta and narrating fiction

See the full report at [tryglassbox.vercel.app](https://tryglassbox.vercel.app) → Report tab.

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
TICK_SECONDS=120
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
    build.ts      HTML report generator
    site.ts       full multi-page site generator
  persist/
    push.ts       hourly GitHub log sync (for server deployments)
  server.ts       HTTP server + agent (for Render / cloud deployment)
  types.ts        shared types and Decision Record schema
```

---

## Deploy your own instance

The agent runs continuously and needs a server. The free stack:

**Render** (runs the agent) + **Vercel** (hosts the site)

See the [Docs tab](https://tryglassbox.vercel.app/#docs) on the live site for the full deployment guide.

---

Built for **Bitget AI Base Camp Hackathon S1 · Track 2 · Trading Infra**

MIT License
