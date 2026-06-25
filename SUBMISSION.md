# Glass Box — Hackathon Submission Description
# Track 2: Trading Infra
# Bitget AI Base Camp Hackathon S1
#
# Copy-paste each part into the submission form at:
# https://forms.gle/CEGB6fRtuobD3bCj8

---

## Part 1: The problem

Every LLM trading agent has the same quiet flaw. It gives a reason for every trade. But nobody checks if that reason is actually true.

When an agent goes long on BTC and writes "breaking the 4-hour range with bullish momentum and positive funding, trend continuation play" — that sentence feels like real analysis. But it might be completely made up after the fact. The agent might have won that trade purely because BTC went up 2% that hour. Just raw exposure, not reasoning. The stated thesis is a story the agent tells itself, and without anything to audit it, there is no way to know the difference between a real edge and a confident-sounding narrative.

This is not a small problem. It is the core failure mode of LLM trading agents.

A rules-based quant system has no language, so it cannot deceive itself. A traditional ML model has no thesis, it just outputs a probability. An LLM agent is the first system that reasons out loud about why it trades. Which also makes it the first system that can systematically confabulate a convincing justification for a decision it made for entirely different reasons.

No tool exists today to measure this gap. Glass Box is that tool.

The core idea is simple: the distance between what an LLM agent says drove its decision and what actually drove its PnL is measurable. We call that gap the Self-Deception Index. It is a new metric that only makes sense in a world of reasoning agents, and it is the metric Glass Box is built to produce.

---

## Part 2: What Glass Box does

Glass Box is two things working together.

The first part is a live paper trading agent. It reads real market data from Bitget — price, RSI, funding rate, Fear and Greed index, realized volatility — then asks an LLM to reason about what it sees and return a structured decision. Not just a trade, but a thesis:

    Side: LONG
    Primary driver: mean_reversion
    Confidence: 0.70
    Rationale: "The market is oversold and due for a bounce given the extreme
                RSI reading and recent correction from previous highs."

That record is written to a log before the outcome is known. The agent cannot go back and rewrite its reasoning after it sees whether the trade worked. The thesis is locked at entry.

The second part is the autopsy engine. Once positions close and PnL is known, it runs three analyses over everything the agent logged.

The first analysis is signal attribution. It correlates every objective market feature against realized PnL and answers: what actually predicted your winners? Often the honest answer is just BTC's 24-hour momentum. Beta, not brilliance. PnL is charged round-trip friction first, so the answer reflects tradeable results.

The second analysis is self-deception detection. For each reason the agent cited — momentum breakout, mean reversion, trend follow, and so on — it asks: when the agent cited this reason, did those trades actually beat its baseline win rate? Crucially, the baseline is direction-adjusted: a driver is compared against the same long/short mix of trades that did not cite it, so a label cannot look like an edge just by riding the market's direction. Lift is confirmed with a two-proportion z-test, so only statistically significant results earn a real-edge or harmful verdict. Thin samples stay flagged as insufficient data. The engine flags each reason with a plain verdict: real edge, decorative, or harmful — and harmful drivers are then removed from the agent's allowed set on the next tick.

The third analysis is confidence calibration. It checks whether the agent's stated confidence actually predicted outcomes. LLMs are almost always overconfident. When an agent says 0.9, does it win 90% of the time or 52%? That gap is measured and reported.

Everything gets compiled into a self-contained HTML report. Judges open one file in a browser. No server, no login, no setup.

---

## Deployment link

https://useglassbox.vercel.app

---

## Part 3: How it works

The stack is TypeScript and Node.js 24, with zero runtime dependencies. It runs anywhere Node is installed.

Here is how data moves through the system:

Bitget's public API feeds in 1-hour candles, funding rates, and ticker data. The alternative.me Fear and Greed index comes in alongside it. Those get combined into a MarketSnapshot object with six features: price, RSI, one-hour return, 24-hour return, funding rate, fear and greed, and realized volatility.

That snapshot goes to the LLM. The model is instructed to return a structured decision with a primary driver chosen from a fixed set of tags, a confidence score between 0 and 1, and a natural language rationale. The driver has to come from that fixed set because free-text reasons cannot be aggregated across hundreds of trades. A closed enum can. This is what makes the self-deception analysis statistically valid rather than just vibes.

The decision gets written to trades.jsonl before the position opens. After the hold period, the exit price comes in, PnL is calculated, and the record is closed.

The autopsy engine then reads the full log and runs Pearson correlations for signal attribution, win rate splits per driver for the self-deception check, and confidence bucket analysis for calibration. Everything writes out to report.html.

A few other things worth knowing. The LLM layer is provider-agnostic. One environment variable swap points it at Groq, the hackathon Qwen endpoint, Gemini, or anything with an OpenAI-compatible API. No code change required. If the LLM call fails for any reason, that tick falls back to a rules engine so the loop never stalls. And the engine reads a simple enough JSONL schema that any external agent can point its own trade log at Glass Box and get an autopsy without touching the agent code.

Running it takes four commands:

    git clone https://github.com/IamHarrie-Labs/glass-box
    cd glass-box && npm install
    cp .env.example .env
    npm run agent

Then when you want the report:

    npm run autopsy
    npm run report
    # open data/report.html in a browser

There is also a fully offline demo that needs no keys or network connection:

    npm run demo

---

## Part 4: What it does not do yet, and where it goes

A few things are worth being straight about.

The self-deception analysis gets meaningful around 30 to 50 closed trades per driver. In a short hackathon window, some driver verdicts will come back as insufficient data. That is honest, not a bug. The engine does not manufacture false confidence in its own findings.

The agent itself is deliberately simple. It rotates through a handful of perpetuals (BTCUSDT, ETHUSDT, SOLUSDT) on a fixed hold, using only the objective market features. It is not trying to be profitable. It is trying to be an honest subject for the autopsy engine to analyze. A more sophisticated agent would produce richer findings. This one proves the concept works.

It only does paper trading by default. Live execution through the Bitget MCP server is documented in the README for anyone who wants it.

And right now it autopsies one agent's log at a time. Multi-agent comparison is architecturally ready since the schema is agent-agnostic, but it is not surfaced in the UI yet.

On where this goes: Glass Box is a first layer of what should become standard infrastructure for LLM trading. Think of it as the equivalent of a model card, but for an agent's reasoning honesty. As more agents trade autonomously, the ability to audit whether a stated thesis is causal or decorative becomes a real risk management question. A fund running ten LLM agents needs to know which one is actually reasoning and which one is just telling good stories. Glass Box answers that question.

The natural next step is a continuous monitoring mode. Instead of a post-hoc report, a live dashboard that tracks the Self-Deception Index as the agent trades and raises a flag when its reasoning starts drifting from its actual drivers before the losses pile up.
