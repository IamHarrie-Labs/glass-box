/**
 * `npm run site` — generates data/index.html, a full multi-page site with:
 *   Home      — landing page + "how it works" flow (matches the Petri diagram aesthetic)
 *   Logs      — live trade log viewer (embedded from trades.jsonl at build time)
 *   Report    — autopsy findings (from report.json)
 *   Docs      — installation + usage + schema reference
 *
 * Everything is a single self-contained HTML file. No server, no login, no deps.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { AutopsyReport } from "../engine/autopsy.ts";
import type { DecisionRecord } from "../types.ts";

// ── data ────────────────────────────────────────────────────────────────────
const trades: DecisionRecord[] = existsSync("data/trades.jsonl")
  ? readFileSync("data/trades.jsonl", "utf8")
      .split("\n").filter(Boolean)
      .map((l) => JSON.parse(l))
  : [];

const report: AutopsyReport | null = existsSync("data/report.json")
  ? JSON.parse(readFileSync("data/report.json", "utf8"))
  : null;

// ── helpers ──────────────────────────────────────────────────────────────────
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const verdictColor: Record<string, string> = {
  real_edge: "#72BFA2", decorative: "#E8A847", harmful: "#E07070", insufficient_data: "#C4B49A",
};

// ── logo SVG (inline wordmark) ───────────────────────────────────────────────
const LOGO = `<svg width="130" height="28" viewBox="0 0 130 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Glass Box">
  <!-- box icon: outer square + inner lens suggesting transparency -->
  <rect x="1" y="4" width="20" height="20" rx="4" stroke="#8AB4D6" stroke-width="1.8" fill="none"/>
  <circle cx="11" cy="14" r="4.5" stroke="#8AB4D6" stroke-width="1.5" fill="none"/>
  <line x1="14.2" y1="17.2" x2="17.5" y2="20.5" stroke="#8AB4D6" stroke-width="1.8" stroke-linecap="round"/>
  <!-- wordmark -->
  <text x="28" y="19" font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif" font-size="15" fill="#1A1A1A" font-weight="300" letter-spacing="-0.2">glass</text>
  <text x="67" y="19" font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif" font-size="15" fill="#1A1A1A" font-weight="600" letter-spacing="-0.2">box</text>
</svg>`;

// ── section: landing ─────────────────────────────────────────────────────────
const LANDING = `
<section id="page-home" class="page active">
  <div class="hero">
    <div class="hero-tag">Track 2 · Trading Infra · Bitget AI Hackathon S1</div>
    <h1 class="hero-title">Your agent sounds confident.<br>We check if it's right.</h1>
    <p class="hero-sub">Glass Box measures the gap between what an LLM trading agent <em>says</em> drove its decision and what actually drove its PnL. We call that gap the Self-Deception Index.</p>
    <div class="hero-btns">
      <button class="btn-primary" onclick="nav('logs')">View live logs</button>
      <button class="btn-ghost" onclick="nav('docs')">Read the docs</button>
    </div>
  </div>

  <div class="flow-section">
    <h2 class="section-title">How it works</h2>
    <p class="section-sub">Two systems. One surfaces reasoning. The other audits it.</p>
    <div class="flow-cols">

      <div class="flow-col">
        <div class="flow-col-label">Without Glass Box</div>
        <div class="flow-step step-tan">
          <div class="step-icon">?</div>
          <div>
            <div class="step-title">Agent trades</div>
            <div class="step-body">Produces confident natural-language rationale per trade</div>
          </div>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step step-amber">
          <div class="step-icon">!</div>
          <div>
            <div class="step-title">Story is accepted</div>
            <div class="step-body">"Going long — momentum breakout with bullish funding"</div>
          </div>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step step-blue">
          <div class="step-icon">≈</div>
          <div>
            <div class="step-title">No verification</div>
            <div class="step-body">Nobody checks if that reason actually predicted the outcome</div>
          </div>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step step-blue">
          <div class="step-icon">↘</div>
          <div>
            <div class="step-title">Silent drift</div>
            <div class="step-body">Agent keeps citing decorative reasons while losing on hidden drivers</div>
          </div>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step step-red">
          <div class="step-icon">✕</div>
          <div>
            <div class="step-title">No insight</div>
            <div class="step-body">You only learn what went wrong after the losses add up</div>
          </div>
        </div>
      </div>

      <div class="flow-col">
        <div class="flow-col-label" style="color:#8AB4D6">With Glass Box</div>
        <div class="flow-step step-tan">
          <div class="step-icon">?</div>
          <div>
            <div class="step-title">Agent trades</div>
            <div class="step-body">Produces confident natural-language rationale per trade</div>
          </div>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step step-amber">
          <div class="step-icon">⬡</div>
          <div>
            <div class="step-title">Thesis locked</div>
            <div class="step-body">Decision record written before outcome is known — agent cannot revise it</div>
          </div>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step step-blue">
          <div class="step-icon">⊕</div>
          <div>
            <div class="step-title">Autopsy engine runs</div>
            <div class="step-body">Signal attribution · Self-deception detection · Confidence calibration</div>
          </div>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step step-blue">
          <div class="step-icon">◎</div>
          <div>
            <div class="step-title">Verdicts issued</div>
            <div class="step-body">Each stated driver scored: real edge / decorative / harmful</div>
          </div>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step step-teal">
          <div class="step-icon">↺</div>
          <div>
            <div class="step-title">Agent improves</div>
            <div class="step-body">Self-Deception Index tracked over time. Drift caught early.</div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <div class="metrics-row">
    <div class="metric-card">
      <div class="metric-num">${trades.length}</div>
      <div class="metric-label">Trades logged</div>
    </div>
    <div class="metric-card">
      <div class="metric-num">${trades.filter(t => t.outcome).length}</div>
      <div class="metric-label">Positions closed</div>
    </div>
    <div class="metric-card">
      <div class="metric-num">${report ? pct(report.selfDeceptionIndex) : "—"}</div>
      <div class="metric-label">Self-deception index</div>
    </div>
    <div class="metric-card">
      <div class="metric-num">${report ? pct(report.overconfidenceGap) : "—"}</div>
      <div class="metric-label">Overconfidence gap</div>
    </div>
  </div>
</section>`;

// ── section: logs ─────────────────────────────────────────────────────────────
function buildLogRows(): string {
  if (!trades.length) return `<tr><td colspan="6" class="empty">No trades logged yet. Run <code>npm run agent</code> to start.</td></tr>`;
  return [...trades].reverse().map(t => {
    const side = t.side === "long"
      ? `<span class="pill pill-long">LONG</span>`
      : `<span class="pill pill-short">SHORT</span>`;
    const closed = t.outcome
      ? `<span class="pill pill-${t.outcome.pnlUsd >= 0 ? "win" : "loss"}">${t.outcome.pnlUsd >= 0 ? "+" : ""}$${t.outcome.pnlUsd.toFixed(0)}</span>`
      : `<span class="pill pill-open">open</span>`;
    const ts = new Date(t.timestamp).toLocaleString("en-GB", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
    return `<tr>
      <td class="td-mono">${ts}</td>
      <td>${side}</td>
      <td class="td-mono">$${t.entryPrice.toFixed(1)}</td>
      <td><span class="driver-tag">${t.statedThesis.primaryDriver}</span></td>
      <td class="td-conf">${(t.statedThesis.confidence * 100).toFixed(0)}%</td>
      <td class="td-rationale">${esc(t.statedThesis.naturalLanguage)}</td>
      <td>${closed}</td>
    </tr>`;
  }).join("");
}

const LOGS = `
<section id="page-logs" class="page">
  <div class="page-header">
    <h2>Live trade log</h2>
    <p>Every decision the agent made, with its stated thesis locked in before the outcome was known.</p>
  </div>
  <div class="card">
    <div class="log-filters">
      <input id="log-search" type="text" placeholder="Search rationale..." oninput="filterLogs()" />
      <select id="log-driver" onchange="filterLogs()">
        <option value="">All drivers</option>
        <option>momentum_breakout</option>
        <option>mean_reversion</option>
        <option>trend_follow</option>
        <option>sentiment_extreme</option>
        <option>funding_signal</option>
        <option>breakdown_short</option>
        <option>news_catalyst</option>
      </select>
      <select id="log-side" onchange="filterLogs()">
        <option value="">Both sides</option>
        <option value="long">Long only</option>
        <option value="short">Short only</option>
      </select>
    </div>
    <div class="table-wrap">
      <table id="log-table">
        <thead><tr>
          <th>Time</th><th>Side</th><th>Entry</th><th>Driver</th><th>Conf</th><th>Rationale</th><th>Result</th>
        </tr></thead>
        <tbody id="log-body">${buildLogRows()}</tbody>
      </table>
    </div>
  </div>
</section>`;

// ── section: report ───────────────────────────────────────────────────────────
function buildReport(): string {
  if (!report) return `<div class="card empty-card"><p>No autopsy data yet. Run <code>npm run autopsy</code> first.</p></div>`;
  const attrRows = report.attribution.map(a => {
    const w = Math.abs(a.correlationWithPnl) * 100;
    const col = a.correlationWithPnl >= 0 ? "#8AB4D6" : "#E07070";
    return `<tr><td>${a.feature}</td><td class="td-num">${a.correlationWithPnl.toFixed(2)}</td>
      <td class="td-bar"><span style="width:${w}%;background:${col};display:block;height:8px;border-radius:4px"></span></td></tr>`;
  }).join("");
  const driverRows = report.drivers.map(d => `<tr>
    <td>${d.driver}</td>
    <td class="td-num">${d.timesCited}</td>
    <td class="td-num">${pct(d.winRateWhenCited)}</td>
    <td class="td-num">${pct(d.baselineWinRate)}</td>
    <td class="td-num">${(d.edge * 100).toFixed(1)}pp</td>
    <td><span class="pill" style="background:${verdictColor[d.verdict]};color:#fff;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600">${d.verdict.replace("_"," ")}</span></td>
    <td class="td-rationale">${esc(d.sampleRationale ?? "")}</td>
  </tr>`).join("");
  const calRows = report.calibration.map(c => {
    const over = c.gap > 0.1;
    return `<tr><td>${c.label}</td><td class="td-num">${c.trades}</td>
      <td class="td-num">${pct(c.avgConfidence)}</td>
      <td class="td-num">${pct(c.actualWinRate)}</td>
      <td class="td-num" style="color:${over?"#E07070":"#6B6866"}">${(c.gap*100).toFixed(1)}pp${over?" ⚠":""}</td></tr>`;
  }).join("");
  return `
  <div class="verdict-banner">${esc(report.headline)}</div>
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-v">${report.totalTrades}</div><div class="kpi-l">Trades</div></div>
    <div class="kpi-card"><div class="kpi-v">${pct(report.overallWinRate)}</div><div class="kpi-l">Win rate</div></div>
    <div class="kpi-card"><div class="kpi-v">${pct(report.selfDeceptionIndex)}</div><div class="kpi-l">Self-deception</div></div>
    <div class="kpi-card"><div class="kpi-v">${pct(report.overconfidenceGap)}</div><div class="kpi-l">Overconfidence</div></div>
  </div>
  <div class="card">
    <h3>What actually drove PnL</h3>
    <p class="card-sub">Correlation of each objective market feature with realized PnL.</p>
    <table><thead><tr><th>Feature</th><th class="td-num">Corr</th><th>Strength</th></tr></thead><tbody>${attrRows}</tbody></table>
  </div>
  <div class="card">
    <h3>Are the stated reasons real?</h3>
    <p class="card-sub">When the agent cited each driver, did those trades beat its baseline? "Decorative" means the reason was a story, not an edge.</p>
    <table><thead><tr><th>Driver</th><th class="td-num">Cited</th><th class="td-num">Win%</th><th class="td-num">Base%</th><th class="td-num">Edge</th><th>Verdict</th><th>Sample quote</th></tr></thead><tbody>${driverRows}</tbody></table>
  </div>
  <div class="card">
    <h3>Confidence calibration</h3>
    <p class="card-sub">When the agent was confident, did it actually win more?</p>
    <table><thead><tr><th>Confidence</th><th class="td-num">Trades</th><th class="td-num">Said</th><th class="td-num">Won</th><th class="td-num">Gap</th></tr></thead><tbody>${calRows}</tbody></table>
  </div>`;
}

const REPORT = `
<section id="page-report" class="page">
  <div class="page-header">
    <h2>Autopsy report</h2>
    <p>The engine's verdict on whether the agent's stated reasoning actually explains its results.</p>
  </div>
  ${buildReport()}
</section>`;

// ── section: docs ─────────────────────────────────────────────────────────────
const DOCS = `
<section id="page-docs" class="page">
  <div class="page-header">
    <h2>Documentation</h2>
    <p>Everything you need to install, run, and extend Glass Box.</p>
  </div>

  <div class="docs-grid">
    <nav class="docs-nav">
      <div class="docs-nav-group">Getting started</div>
      <a href="#install" class="docs-link active">Installation</a>
      <a href="#configure" class="docs-link">Configuration</a>
      <a href="#commands" class="docs-link">Commands</a>
      <div class="docs-nav-group">Reference</div>
      <a href="#schema" class="docs-link">Decision record schema</a>
      <a href="#drivers" class="docs-link">Driver tags</a>
      <a href="#engine" class="docs-link">Engine outputs</a>
    </nav>

    <div class="docs-content">
      <div id="install" class="docs-section">
        <h3>Installation</h3>
        <p>Glass Box requires Node.js 20 or later. No other runtime dependencies.</p>
        <pre><code>git clone https://github.com/IamHarrie-Labs/glass-box
cd glass-box
npm install</code></pre>
      </div>

      <div id="configure" class="docs-section">
        <h3>Configuration</h3>
        <p>Copy <code>.env.example</code> to <code>.env</code> and fill in your LLM key. The agent loads it automatically.</p>
        <pre><code># Required to enable the LLM brain
LLM_API_KEY=your-key-here

# Defaults to Bitget hackathon Qwen endpoint
# Any OpenAI-compatible endpoint works
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.1-8b-instant

# Tick interval in seconds (120 = 1 call / 2 min, safe for free tiers)
TICK_SECONDS=120</code></pre>
        <p>Swap LLM providers with no code change — just update the three env vars. Tested with Groq, Gemini, the Bitget hackathon Qwen endpoint, and OpenAI.</p>
      </div>

      <div id="commands" class="docs-section">
        <h3>Commands</h3>
        <div class="cmd-list">
          <div class="cmd-row">
            <div class="cmd-name"><code>npm run agent</code></div>
            <div class="cmd-desc">Starts the live paper-trading agent. Ticks every <code>TICK_SECONDS</code>, fetches Bitget market data, asks the LLM to reason, logs a decision record. Runs continuously until stopped.</div>
          </div>
          <div class="cmd-row">
            <div class="cmd-name"><code>npm run autopsy</code></div>
            <div class="cmd-desc">Reads <code>data/trades.jsonl</code>, closes matured positions, runs the three autopsy analyses (attribution, self-deception, calibration), writes <code>data/report.json</code>.</div>
          </div>
          <div class="cmd-row">
            <div class="cmd-name"><code>npm run report</code></div>
            <div class="cmd-desc">Reads <code>data/report.json</code> and generates <code>data/report.html</code>, a self-contained audit report. Open in any browser.</div>
          </div>
          <div class="cmd-row">
            <div class="cmd-name"><code>npm run site</code></div>
            <div class="cmd-desc">Builds this full site (<code>data/index.html</code>) with live data embedded from <code>trades.jsonl</code> and <code>report.json</code>.</div>
          </div>
          <div class="cmd-row">
            <div class="cmd-name"><code>npm run demo</code></div>
            <div class="cmd-desc">Seeds synthetic trades, runs autopsy, builds report. Fully offline — no keys or network needed. Good for a quick proof-of-concept.</div>
          </div>
        </div>
      </div>

      <div id="schema" class="docs-section">
        <h3>Decision record schema</h3>
        <p>Every trade the agent opens is written to <code>data/trades.jsonl</code> as one JSON object per line. The thesis is written before the position opens — outcome fields are filled in after close.</p>
        <pre><code>{
  "tradeId": "t_51bfe01c",
  "timestamp": "2026-06-23T09:17:09.000Z",
  "pair": "BTCUSDT",
  "side": "long",
  "entryPrice": 62446.5,
  "sizeUsd": 1000,
  "statedThesis": {
    "primaryDriver": "mean_reversion",   // closed enum — see Driver tags
    "supportingSignals": ["rsi_oversold", "funding_negative"],
    "confidence": 0.70,
    "naturalLanguage": "The market is oversold and due for a bounce..."
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
  "outcome": {               // null until position closes
    "exitPrice": 63100.0,
    "pnlUsd": 10.47,
    "heldMinutes": 240
  }
}</code></pre>
        <p>Any external agent that logs this schema can be autopsied by Glass Box without touching the agent code.</p>
      </div>

      <div id="drivers" class="docs-section">
        <h3>Driver tags</h3>
        <p>The LLM is constrained to map its reasoning onto this closed enum. Free-text reasons cannot be aggregated across trades — a closed enum can. This is what makes the self-deception analysis statistically valid.</p>
        <div class="driver-table">
          <div class="driver-row"><code>momentum_breakout</code><span>Price breaking a level with volume/trend confirmation</span></div>
          <div class="driver-row"><code>mean_reversion</code><span>Price has overshot and is due to revert</span></div>
          <div class="driver-row"><code>trend_follow</code><span>Established trend continuation</span></div>
          <div class="driver-row"><code>sentiment_extreme</code><span>Fear and Greed or positioning at an extreme</span></div>
          <div class="driver-row"><code>funding_signal</code><span>Funding rate imbalance suggesting crowded positioning</span></div>
          <div class="driver-row"><code>breakdown_short</code><span>Support break with downside momentum</span></div>
          <div class="driver-row"><code>news_catalyst</code><span>Identifiable news or macro event driving price</span></div>
        </div>
      </div>

      <div id="engine" class="docs-section">
        <h3>Engine outputs</h3>
        <p>The autopsy engine produces three analyses and compiles them into a report object written to <code>data/report.json</code>.</p>
        <div class="cmd-list">
          <div class="cmd-row">
            <div class="cmd-name">Signal attribution</div>
            <div class="cmd-desc">Pearson correlation of each objective market feature (RSI, 1h return, 24h return, funding rate, Fear and Greed, volatility) with realized PnL. Answers: what actually predicted your winners, regardless of what you said?</div>
          </div>
          <div class="cmd-row">
            <div class="cmd-name">Self-deception detection</div>
            <div class="cmd-desc">For each driver the agent cited, compares the win rate on those trades against the agent's baseline win rate. If citing a driver produces no lift, it is flagged as <strong>decorative</strong>. If it hurts, it is <strong>harmful</strong>.</div>
          </div>
          <div class="cmd-row">
            <div class="cmd-name">Confidence calibration</div>
            <div class="cmd-desc">Groups trades by stated confidence bucket and compares stated confidence against actual win rate. The Overconfidence Gap is the average spread between what the agent said and what happened.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;

// ── full page shell ───────────────────────────────────────────────────────────
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Glass Box · Agent Autopsy Engine</title>
<style>
/* ── reset + base ── */
*{box-sizing:border-box;margin:0;padding:0}
body{background:#EDECEA;color:#1A1A1A;font:15px/1.6 ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif;min-height:100vh}
a{color:inherit;text-decoration:none}
code,pre{font-family:ui-monospace,"Cascadia Code","Fira Code",monospace}

/* ── layout ── */
.shell{display:flex;flex-direction:column;min-height:100vh}
.topbar{background:#fff;border-bottom:1px solid #DDD9D5;padding:0 32px;display:flex;align-items:center;gap:32px;height:56px;position:sticky;top:0;z-index:100}
.topbar-logo{display:flex;align-items:center;flex-shrink:0}
.topbar-nav{display:flex;gap:4px;flex:1}
.topbar-nav button{background:none;border:none;padding:6px 14px;border-radius:8px;font:14px/1 inherit;color:#6B6866;cursor:pointer;transition:background .15s,color .15s}
.topbar-nav button:hover{background:#F4F2EF;color:#1A1A1A}
.topbar-nav button.active{background:#F4F2EF;color:#1A1A1A;font-weight:500}
.main{flex:1;padding:40px 32px;max-width:1100px;margin:0 auto;width:100%}

/* ── pages ── */
.page{display:none}.page.active{display:block}

/* ── hero ── */
.hero{text-align:center;padding:56px 0 48px;max-width:680px;margin:0 auto}
.hero-tag{display:inline-block;background:#fff;border:1px solid #DDD9D5;border-radius:99px;padding:4px 14px;font-size:12px;color:#6B6866;letter-spacing:.02em;margin-bottom:20px}
.hero-title{font-size:36px;font-weight:300;line-height:1.25;letter-spacing:-.5px;margin-bottom:16px}
.hero-title em{font-style:italic;font-weight:400}
.hero-sub{color:#6B6866;font-size:16px;line-height:1.65;margin-bottom:28px}
.hero-btns{display:flex;gap:12px;justify-content:center}
.btn-primary{background:#1A1A1A;color:#fff;border:none;padding:10px 22px;border-radius:8px;font:14px/1 inherit;font-weight:500;cursor:pointer;transition:opacity .15s}
.btn-primary:hover{opacity:.82}
.btn-ghost{background:#fff;color:#1A1A1A;border:1px solid #DDD9D5;padding:10px 22px;border-radius:8px;font:14px/1 inherit;cursor:pointer;transition:background .15s}
.btn-ghost:hover{background:#F4F2EF}

/* ── flow diagram ── */
.flow-section{margin-bottom:48px}
.section-title{font-size:20px;font-weight:500;text-align:center;margin-bottom:6px}
.section-sub{color:#6B6866;text-align:center;margin-bottom:32px}
.flow-cols{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:780px;margin:0 auto}
.flow-col-label{font-size:13px;font-weight:600;color:#6B6866;text-align:center;margin-bottom:12px;letter-spacing:.03em;text-transform:uppercase}
.flow-step{background:#fff;border:1px solid #DDD9D5;border-radius:12px;padding:14px 16px;display:flex;gap:14px;align-items:flex-start}
.step-icon{width:28px;height:28px;border-radius:50%;border:1.5px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;margin-top:1px}
.step-title{font-weight:500;font-size:14px;margin-bottom:2px}
.step-body{font-size:13px;color:#6B6866;line-height:1.5}
.step-tan .step-icon{color:#C4B49A;border-color:#C4B49A}
.step-tan{border-left:3px solid #C4B49A}
.step-amber .step-icon{color:#E8A847;border-color:#E8A847}
.step-amber{border-left:3px solid #E8A847;background:#FFFBF2}
.step-blue .step-icon{color:#8AB4D6;border-color:#8AB4D6}
.step-blue{border-left:3px solid #8AB4D6;background:#F4F8FD}
.step-teal .step-icon{color:#72BFA2;border-color:#72BFA2}
.step-teal{border-left:3px solid #72BFA2;background:#F2FBF7}
.step-red .step-icon{color:#E07070;border-color:#E07070}
.step-red{border-left:3px solid #E07070;background:#FDF4F4}
.flow-arrow{text-align:center;color:#C4B49A;font-size:18px;margin:6px 0}

/* ── metrics ── */
.metrics-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:40px}
.metric-card{background:#fff;border:1px solid #DDD9D5;border-radius:12px;padding:18px 20px}
.metric-num{font-size:28px;font-weight:300;letter-spacing:-.5px}
.metric-label{font-size:12px;color:#6B6866;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}

/* ── page header ── */
.page-header{margin-bottom:28px}
.page-header h2{font-size:22px;font-weight:500;margin-bottom:4px}
.page-header p{color:#6B6866}

/* ── cards ── */
.card{background:#fff;border:1px solid #DDD9D5;border-radius:12px;padding:20px 24px;margin-bottom:18px}
.card h3{font-size:15px;font-weight:600;margin-bottom:4px}
.card-sub{color:#6B6866;font-size:13px;margin-bottom:14px}
.empty-card{color:#6B6866;text-align:center;padding:40px}

/* ── tables ── */
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #F0EDE9;font-size:13.5px}
th{color:#6B6866;font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;background:#FAFAF8}
tr:last-child td{border-bottom:none}
tr:hover td{background:#FAFAF8}
.td-num{text-align:right;font-variant-numeric:tabular-nums}
.td-bar{width:36%}
.td-conf{text-align:right;font-variant-numeric:tabular-nums;color:#6B6866}
.td-rationale{color:#6B6866;max-width:320px;font-size:12.5px;line-height:1.45}
.td-mono{font-family:ui-monospace,monospace;font-size:12px;color:#6B6866;white-space:nowrap}
.empty{text-align:center;color:#6B6866;padding:32px}

/* ── pills ── */
.pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11.5px;font-weight:600}
.pill-long{background:#EEF6FF;color:#4A90C4}
.pill-short{background:#FEF3F3;color:#C45050}
.pill-open{background:#F4F2EF;color:#6B6866}
.pill-win{background:#F0FBF5;color:#3A9E6E}
.pill-loss{background:#FEF3F3;color:#C45050}
.driver-tag{display:inline-block;background:#F4F2EF;color:#4A4845;padding:2px 8px;border-radius:6px;font-size:11.5px;font-family:ui-monospace,monospace}

/* ── logs filters ── */
.log-filters{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.log-filters input,.log-filters select{background:#F4F2EF;border:1px solid #DDD9D5;border-radius:8px;padding:7px 12px;font:13px/1 inherit;color:#1A1A1A;outline:none}
.log-filters input{flex:1;min-width:180px}
.log-filters input:focus,.log-filters select:focus{border-color:#8AB4D6}

/* ── verdict banner ── */
.verdict-banner{background:#fff;border:1px solid #DDD9D5;border-left:4px solid #E8A847;border-radius:12px;padding:16px 20px;margin-bottom:20px;font-size:15px;line-height:1.55}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.kpi-card{background:#fff;border:1px solid #DDD9D5;border-radius:12px;padding:14px 16px}
.kpi-v{font-size:22px;font-weight:500}
.kpi-l{font-size:11px;color:#6B6866;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}

/* ── docs ── */
.docs-grid{display:grid;grid-template-columns:200px 1fr;gap:32px;align-items:start}
.docs-nav{background:#fff;border:1px solid #DDD9D5;border-radius:12px;padding:16px;position:sticky;top:72px}
.docs-nav-group{font-size:11px;font-weight:600;color:#6B6866;text-transform:uppercase;letter-spacing:.06em;padding:8px 10px 4px}
.docs-link{display:block;padding:7px 10px;border-radius:7px;font-size:13.5px;color:#4A4845;cursor:pointer}
.docs-link:hover,.docs-link.active{background:#F4F2EF;color:#1A1A1A}
.docs-section{margin-bottom:40px;scroll-margin-top:80px}
.docs-section h3{font-size:17px;font-weight:600;margin-bottom:8px}
.docs-section p{color:#4A4845;margin-bottom:12px;line-height:1.65}
pre{background:#F4F2EF;border:1px solid #DDD9D5;border-radius:10px;padding:16px;overflow-x:auto;font-size:12.5px;line-height:1.6;margin-bottom:14px}
.cmd-list{display:flex;flex-direction:column;gap:1px;border:1px solid #DDD9D5;border-radius:10px;overflow:hidden}
.cmd-row{background:#fff;padding:14px 16px;display:grid;grid-template-columns:200px 1fr;gap:16px;font-size:13.5px}
.cmd-row:not(:last-child){border-bottom:1px solid #F0EDE9}
.cmd-name{font-weight:500}
.cmd-desc{color:#6B6866;line-height:1.55}
.driver-table{border:1px solid #DDD9D5;border-radius:10px;overflow:hidden}
.driver-row{background:#fff;padding:11px 16px;display:grid;grid-template-columns:200px 1fr;gap:16px;font-size:13.5px}
.driver-row:not(:last-child){border-bottom:1px solid #F0EDE9}
.driver-row span{color:#6B6866}

/* ── footer ── */
.foot{border-top:1px solid #DDD9D5;padding:20px 32px;text-align:center;font-size:12px;color:#6B6866;background:#fff}
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="topbar-logo">${LOGO}</div>
    <nav class="topbar-nav">
      <button onclick="nav('home')" id="nav-home" class="active">Home</button>
      <button onclick="nav('logs')" id="nav-logs">Logs <span style="font-size:11px;color:#8AB4D6">${trades.length}</span></button>
      <button onclick="nav('report')" id="nav-report">Report</button>
      <button onclick="nav('docs')" id="nav-docs">Docs</button>
    </nav>
  </header>
  <main class="main">
    ${LANDING}
    ${LOGS}
    ${REPORT}
    ${DOCS}
  </main>
  <footer class="foot">Glass Box · open-source agent audit layer · Bitget AI Hackathon S1 · <a href="https://github.com/IamHarrie-Labs/glass-box" style="color:#8AB4D6">github.com/IamHarrie-Labs/glass-box</a></footer>
</div>
<script>
function nav(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.topbar-nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById('nav-' + page).classList.add('active');
  window.location.hash = page;
}
// restore tab from hash
const h = window.location.hash.slice(1);
if (['home','logs','report','docs'].includes(h)) nav(h);

// log filtering
function filterLogs() {
  const q = document.getElementById('log-search').value.toLowerCase();
  const drv = document.getElementById('log-driver').value;
  const side = document.getElementById('log-side').value;
  document.querySelectorAll('#log-body tr').forEach(row => {
    const text = row.innerText.toLowerCase();
    const matchQ = !q || text.includes(q);
    const matchD = !drv || text.includes(drv);
    const matchS = !side || text.includes(side.toUpperCase());
    row.style.display = (matchQ && matchD && matchS) ? '' : 'none';
  });
}

// docs nav highlight on scroll
document.querySelectorAll('.docs-link').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.docs-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const target = document.querySelector(link.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});
</script>
</body>
</html>`;

writeFileSync("data/index.html", HTML, "utf8");
console.log(`Wrote data/index.html (${trades.length} trades embedded, report: ${report ? "yes" : "no data yet"})`);
console.log("Open data/index.html in a browser.");
