/**
 * `npm run site` — generates docs/index.html.
 * Single-page app with 4 routes: /, /logs, /report, /docs.
 * Clean URL routing via history.pushState (no # in URL).
 * Vercel rewrites send all paths to index.html.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import type { AutopsyReport } from "../engine/autopsy.ts";
import type { DecisionRecord } from "../types.ts";

// ── data ────────────────────────────────────────────────────────────────────
const trades: DecisionRecord[] = existsSync("data/trades.jsonl")
  ? readFileSync("data/trades.jsonl", "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l))
  : [];

const report: AutopsyReport | null = existsSync("data/report.json")
  ? JSON.parse(readFileSync("data/report.json", "utf8"))
  : null;

// ── helpers ──────────────────────────────────────────────────────────────────
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const closedTrades = trades.filter(t => t.outcome);

// SDI colors
const sdiVal  = report?.selfDeceptionIndex ?? 0;
const sdiText = report ? pct(report.selfDeceptionIndex) : "—";
const sdiColor  = sdiVal > 0.5 ? "#f87171" : sdiVal > 0.2 ? "#fbbf24" : "#34d399";
const sdiBg     = sdiVal > 0.5 ? "rgba(248,113,113,0.08)" : sdiVal > 0.2 ? "rgba(251,191,36,0.08)" : "rgba(52,211,153,0.08)";
const sdiBorder = sdiVal > 0.5 ? "rgba(248,113,113,0.22)" : sdiVal > 0.2 ? "rgba(251,191,36,0.22)" : "rgba(52,211,153,0.22)";

// OCG colors
const ocgVal  = report?.overconfidenceGap ?? 0;
const ocgText = report ? pct(report.overconfidenceGap) : "—";
const ocgColor  = ocgVal > 0.1 ? "#fbbf24" : "#34d399";
const ocgBg     = ocgVal > 0.1 ? "rgba(251,191,36,0.08)" : "rgba(52,211,153,0.08)";
const ocgBorder = ocgVal > 0.1 ? "rgba(251,191,36,0.22)" : "rgba(52,211,153,0.22)";

// Driver chip colors
const DC: Record<string, { bg: string; color: string }> = {
  momentum_breakout: { bg: "rgba(56,189,248,0.14)",  color: "#38bdf8" },
  mean_reversion:    { bg: "rgba(167,139,250,0.14)", color: "#a78bfa" },
  trend_follow:      { bg: "rgba(251,191,36,0.14)",  color: "#fbbf24" },
  funding_signal:    { bg: "rgba(52,211,153,0.14)",  color: "#34d399" },
  sentiment_extreme: { bg: "rgba(248,113,113,0.14)", color: "#f87171" },
  breakdown_short:   { bg: "rgba(251,146,60,0.14)",  color: "#fb923c" },
  news_catalyst:     { bg: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.7)" },
};

const VERDICT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  decorative:        { bg: "rgba(251,191,36,0.14)",  color: "#fbbf24", label: "decorative" },
  real_edge:         { bg: "rgba(52,211,153,0.14)",  color: "#34d399", label: "real edge" },
  harmful:           { bg: "rgba(248,113,113,0.14)", color: "#f87171", label: "harmful" },
  insufficient_data: { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", label: "insufficient data" },
};

// ── shared CSS ────────────────────────────────────────────────────────────────
const BASE_CSS = `
@keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
* { box-sizing:border-box; margin:0; padding:0; }
html { scroll-behavior:smooth; }
body {
  font-family:'Poppins',sans-serif;
  background:#06060f;
  color:#fff;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
  hyphens:none;
  -webkit-hyphens:none;
}
::-webkit-scrollbar { width:3px; }
::-webkit-scrollbar-track { background:#06060f; }
::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:2px; }
a { text-decoration:none; color:inherit; }
button { font-family:'Poppins',sans-serif; }
table { width:100%; border-collapse:collapse; }
code { font-family:'Courier New',monospace; }

/* page-level */
.page { display:none; min-height:100vh; }
.page.active { display:block; }
.page-home { display:block; } /* home visible by default */

/* inner pages */
.inner-page { padding:100px 28px 60px; max-width:1200px; margin:0 auto; }
.inner-page.narrow { max-width:1100px; }

/* page header */
.ph { margin-bottom:40px; }
.ph-label { font-size:11px; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:#38bdf8; margin-bottom:10px; }
.ph-title { font-size:clamp(1.5rem,3vw,2.2rem); font-weight:600; letter-spacing:-0.02em; line-height:1.15; }
.ph-sub { font-size:14px; color:rgba(255,255,255,0.5); margin-top:8px; line-height:1.6; max-width:580px; }

/* cards */
.card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius:16px; padding:24px; margin-bottom:20px; }
.card-title { font-size:15px; font-weight:600; margin-bottom:6px; }
.card-sub { font-size:13px; color:rgba(255,255,255,0.45); margin-bottom:18px; line-height:1.6; }

/* tables */
.tbl-wrap { overflow-x:auto; border-radius:14px; border:1px solid rgba(255,255,255,0.08); }
.tbl-wrap table { min-width:600px; }
thead tr { background:rgba(255,255,255,0.04); border-bottom:1px solid rgba(255,255,255,0.08); }
th { text-align:left; padding:12px 16px; font-size:10.5px; font-weight:500; color:rgba(255,255,255,0.4); letter-spacing:0.07em; text-transform:uppercase; white-space:nowrap; }
th.right { text-align:right; }
td { padding:13px 16px; border-bottom:1px solid rgba(255,255,255,0.04); font-size:13px; color:rgba(255,255,255,0.75); vertical-align:middle; }
td.right { text-align:right; }
td.dim { color:rgba(255,255,255,0.45); }
td.mono { font-family:'Courier New',monospace; font-size:12px; color:rgba(255,255,255,0.6); }
tbody tr:last-child td { border-bottom:none; }

/* chips / filter buttons */
.chips { display:flex; flex-wrap:wrap; gap:7px; }
.chip { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.09); color:rgba(255,255,255,0.6); padding:5px 13px; border-radius:100px; font-size:12px; font-weight:400; cursor:pointer; font-family:'Poppins',sans-serif; transition:all 0.15s; }
.chip.on { background:rgba(56,189,248,0.16); border-color:rgba(56,189,248,0.4); color:#38bdf8; font-weight:500; }

/* kpi grid */
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; margin-bottom:32px; }
.kpi-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius:16px; padding:22px 20px; }
.kpi-num { font-size:2rem; font-weight:600; letter-spacing:-0.03em; line-height:1; margin-bottom:6px; }
.kpi-lbl { font-size:11px; font-weight:400; color:rgba(255,255,255,0.45); letter-spacing:0.02em; }

/* footer */
.foot { border-top:1px solid rgba(255,255,255,0.07); padding:28px 28px; margin-top:auto; }
.foot-inner { max-width:1200px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; }
.foot-logo { display:flex; align-items:center; gap:9px; font-size:14px; font-weight:600; color:rgba(255,255,255,0.55); letter-spacing:0.04em; }
.foot-links { display:flex; align-items:center; gap:20px; }
.foot-links a { font-size:12px; color:rgba(255,255,255,0.35); transition:color 0.15s; }
.foot-links a:hover { color:rgba(255,255,255,0.7); }

/* doc tabs */
.doc-tabs { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:28px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:5px; width:fit-content; }
.doc-tab { background:transparent; border:1px solid transparent; color:rgba(255,255,255,0.45); padding:7px 16px; border-radius:8px; font-size:13px; cursor:pointer; font-weight:400; transition:all 0.15s; }
.doc-tab.on { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.14); color:#fff; font-weight:500; }
.doc-panel { display:none; animation:fadeUp 0.3s ease-out both; }
.doc-panel.on { display:block; }

/* pre blocks */
pre { background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.09); border-radius:12px; padding:22px; font-family:'Courier New',monospace; font-size:12.5px; line-height:1.85; color:rgba(255,255,255,0.78); overflow-x:auto; white-space:pre; margin-bottom:16px; }

/* cmd list */
.cmd-list { display:flex; flex-direction:column; gap:10px; }
.cmd-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:18px 22px; }
.cmd-card code { font-size:14px; color:#38bdf8; }
.cmd-card p { font-size:13px; color:rgba(255,255,255,0.45); margin-top:7px; line-height:1.6; }

/* driver tag list in docs */
.tag-list { display:flex; flex-direction:column; gap:8px; }
.tag-row { display:flex; gap:16px; align-items:flex-start; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:15px 20px; }
.tag-row code { font-family:'Courier New',monospace; font-size:12px; flex-shrink:0; min-width:165px; }
.tag-row span { font-size:13px; color:rgba(255,255,255,0.45); line-height:1.5; }

/* caveat */
.caveat { font-size:11.5px; color:rgba(255,255,255,0.28); font-style:italic; margin-top:12px; line-height:1.55; border-top:1px dashed rgba(255,255,255,0.09); padding-top:11px; }

/* nav */
#gb-nav { position:fixed; top:0; left:0; right:0; z-index:100; padding:13px 20px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid transparent; transition:background 0.3s,border-color 0.3s; }
#gb-nav.scrolled { background:rgba(6,6,15,0.92); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border-bottom-color:rgba(255,255,255,0.08); }
.nav-pill { display:flex; align-items:center; background:rgba(6,6,15,0.72); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.13); border-radius:14px; padding:8px 18px; gap:0; }
.nav-logo { display:flex; align-items:center; gap:8px; }
.nav-logo span { font-size:15px; font-weight:700; color:#fff; letter-spacing:0.05em; }
#desktop-links { display:flex; gap:2px; margin-left:24px; }
.nav-btn { background:transparent; border:none; color:rgba(255,255,255,0.65); padding:5px 11px; border-radius:8px; font-size:13px; font-weight:400; cursor:pointer; transition:all 0.15s; display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
.nav-btn:hover { color:#fff; background:rgba(255,255,255,0.07); }
.nav-btn.on { color:#fff; background:rgba(255,255,255,0.12); font-weight:500; }
.nav-badge { font-size:10px; background:rgba(56,189,248,0.2); color:#38bdf8; padding:1px 6px; border-radius:4px; }
.nav-right { display:flex; align-items:center; gap:10px; }
.gh-link { display:inline-flex; align-items:center; gap:5px; background:#fff; color:#06060f; font-weight:600; font-size:13px; padding:8px 16px; border-radius:100px; }
#burger-btn { display:none; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:8px 10px; cursor:pointer; align-items:center; justify-content:center; }
#mobile-menu { display:none; position:fixed; top:70px; left:12px; right:12px; z-index:99; background:rgba(6,6,15,0.97); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border:1px solid rgba(255,255,255,0.11); border-radius:18px; padding:14px; flex-direction:column; gap:3px; }
.mob-link { color:rgba(255,255,255,0.75); font-size:15px; font-weight:400; padding:12px 16px; border-radius:10px; display:block; border:none; background:none; cursor:pointer; text-align:left; font-family:'Poppins',sans-serif; transition:background 0.15s; }
.mob-link:hover { background:rgba(255,255,255,0.07); }
`;

// ── row builders ─────────────────────────────────────────────────────────────
function tradeRows(): string {
  if (!trades.length)
    return `<tr><td colspan="7" style="text-align:center;padding:48px;color:rgba(255,255,255,0.35);font-size:14px;">No trades yet. Run <code>npm run agent</code> to start.</td></tr>`;

  return [...trades].reverse().map(t => {
    const dc = DC[t.statedThesis.primaryDriver] ?? DC.news_catalyst;
    const ts = new Date(t.timestamp).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const sideColor = t.side === "long" ? "#34d399" : "#f87171";
    const raw = esc(t.statedThesis.naturalLanguage);
    const short = raw.length > 70 ? raw.slice(0, 70) + "…" : raw;
    let result: string;
    if (!t.outcome) {
      result = `<span style="color:rgba(255,255,255,0.35);font-size:12px;font-weight:500;">open</span>`;
    } else {
      const p = t.outcome.pnlUsd;
      result = `<span style="color:${p >= 0 ? "#34d399" : "#f87171"};font-weight:600;font-size:13px;">${p >= 0 ? "+" : ""}$${Math.abs(p).toFixed(0)}</span>`;
    }
    return `<tr data-driver="${esc(t.statedThesis.primaryDriver)}" data-side="${t.side}">
      <td class="mono">${ts}</td>
      <td style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${sideColor};">${t.side === "long" ? "LONG" : "SHORT"}</td>
      <td class="mono">$${t.entryPrice.toFixed(1)}</td>
      <td><span style="background:${dc.bg};color:${dc.color};padding:2px 8px;border-radius:5px;font-size:11px;font-family:'Courier New',monospace;white-space:nowrap;">${esc(t.statedThesis.primaryDriver)}</span></td>
      <td class="right dim">${(t.statedThesis.confidence * 100).toFixed(0)}%</td>
      <td class="dim" style="font-size:12px;max-width:280px;line-height:1.5;">${short}</td>
      <td class="right">${result}</td>
    </tr>`;
  }).join("");
}

function signalRows(): string {
  if (!report?.attribution?.length)
    return `<div style="padding:24px;text-align:center;color:rgba(255,255,255,0.35);">No data. Run <code>npm run autopsy</code>.</div>`;
  const maxC = Math.max(...report.attribution.map(a => Math.abs(a.correlationWithPnl)));
  return report.attribution.map(a => {
    const pos = a.correlationWithPnl >= 0;
    const w = maxC > 0 ? (Math.abs(a.correlationWithPnl) / maxC * 100).toFixed(1) : "0";
    const bar = pos ? "linear-gradient(90deg,#38bdf8,#0ea5e9)" : "linear-gradient(90deg,#f87171,#ef4444)";
    const lbl = (a.correlationWithPnl >= 0 ? "+" : "") + a.correlationWithPnl.toFixed(2);
    return `<div style="display:flex;align-items:center;gap:14px;padding:13px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="font-family:'Courier New',monospace;font-size:12px;color:rgba(255,255,255,0.65);width:128px;flex-shrink:0;">${esc(a.feature)}</span>
      <div style="flex:1;background:rgba(255,255,255,0.07);border-radius:4px;height:7px;overflow:hidden;">
        <div style="width:${w}%;height:7px;border-radius:4px;background:${bar};"></div>
      </div>
      <span style="color:${pos ? "#38bdf8" : "#f87171"};font-size:13px;font-weight:600;width:44px;text-align:right;flex-shrink:0;font-family:'Courier New',monospace;">${lbl}</span>
    </div>`;
  }).join("");
}

function driverRows(): string {
  if (!report?.drivers?.length)
    return `<tr><td colspan="7" style="text-align:center;padding:40px;color:rgba(255,255,255,0.35);">No data yet.</td></tr>`;
  return report.drivers.map(d => {
    const v = VERDICT_STYLE[d.verdict] ?? VERDICT_STYLE.decorative;
    const ep = (d.edge * 100).toFixed(1);
    const dc = d.edge > 0.02 ? "#34d399" : d.edge < -0.02 ? "#f87171" : "rgba(255,255,255,0.4)";
    const ls = `${d.longCited ?? 0}L / ${d.shortCited ?? 0}S`;
    return `<tr>
      <td><code style="background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:4px;font-size:11px;color:rgba(255,255,255,0.8);">${esc(d.driver)}</code></td>
      <td class="right dim">${d.timesCited}x</td>
      <td class="dim" style="font-size:12px;">${ls}</td>
      <td class="right" style="font-weight:500;">${pct(d.winRateWhenCited)}</td>
      <td class="right dim">${pct(d.baselineWinRate)}</td>
      <td class="right"><span style="color:${dc};font-weight:600;font-size:13px;">${d.edge >= 0 ? "+" : ""}${ep}pp</span></td>
      <td><span style="background:${v.bg};color:${v.color};padding:2px 9px;border-radius:100px;font-size:11px;font-weight:500;white-space:nowrap;">${v.label}</span></td>
    </tr>`;
  }).join("");
}

function calRows(): string {
  if (!report?.calibration?.length)
    return `<tr><td colspan="5" style="text-align:center;padding:40px;color:rgba(255,255,255,0.35);">No data yet.</td></tr>`;
  return report.calibration.map(c => {
    const over = c.gap > 0.1;
    return `<tr>
      <td class="mono">${esc(c.label)}</td>
      <td class="right dim">${c.trades}</td>
      <td class="right">${pct(c.avgConfidence)}</td>
      <td class="right"><span style="color:${c.actualWinRate > 0.5 ? "#34d399" : "#f87171"};font-weight:500;">${pct(c.actualWinRate)}</span></td>
      <td class="right"><span style="color:${over ? "#f87171" : "#34d399"};font-weight:600;">${c.gap > 0 ? "+" : ""}${(c.gap * 100).toFixed(1)}pp${over ? " overconfident" : ""}</span></td>
    </tr>`;
  }).join("");
}

function headline(): string {
  if (!report) return "Run <code>npm run autopsy</code> to generate the report.";
  const top = [...report.drivers].sort((a, b) => b.timesCited - a.timesCited)[0];
  const attr = report.attribution[0];
  if (!top || !attr) return esc(report.headline);
  return `Most cited driver <strong style="color:rgba(255,255,255,0.85);">${esc(top.driver)}</strong> is ${esc(top.verdict.replace(/_/g, " "))} (${pct(top.winRateWhenCited)} win vs ${pct(top.baselineWinRate)} baseline). PnL is really driven by <strong style="color:rgba(255,255,255,0.85);">${esc(attr.feature)}</strong> (corr ${attr.correlationWithPnl.toFixed(2)}).`;
}

const assetNote = report?.assets?.length ? ` Across ${report.assets.join(", ")}.` : "";
const attrSub = report?.attribution?.[0]
  ? `Strongest predictor: <strong style="color:rgba(255,255,255,0.75);">${esc(report.attribution[0].feature)}</strong> (r = ${report.attribution[0].correlationWithPnl.toFixed(2)}). Blue bars predicted wins, red bars predicted losses. PnL is net of round-trip friction.${assetNote}`
  : "Run autopsy to see signal attribution.";

// ── nav SVG logo ──────────────────────────────────────────────────────────────
const LOGO_SVG = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
  <polygon points="10,2 18,6 10,10 2,6" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.8)" stroke-width="0.7" stroke-linejoin="round"/>
  <polygon points="2,6 10,10 10,18 2,14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.8)" stroke-width="0.7" stroke-linejoin="round"/>
  <polygon points="10,10 18,6 18,14 10,18" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.8)" stroke-width="0.7" stroke-linejoin="round"/>
</svg>`;

const FOOTER = `<footer style="background:#03030a;border-top:1px solid rgba(255,255,255,0.07);padding:28px;">
  <div class="foot-inner">
    <div class="foot-logo">
      ${LOGO_SVG}
      <span>glassbox</span>
      <span style="font-size:11px;font-weight:400;color:rgba(255,255,255,0.25);margin-left:6px;">open-source agent audit layer</span>
    </div>
    <div class="foot-links">
      <span style="font-size:11px;color:rgba(255,255,255,0.25);">Bitget AI Hackathon S1</span>
      <a href="https://github.com/IamHarrie-Labs/glass-box" target="_blank">github.com/IamHarrie-Labs/glass-box</a>
    </div>
  </div>
</footer>`;

// ── full HTML ─────────────────────────────────────────────────────────────────
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Glass Box | Agent Autopsy Engine</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${BASE_CSS}</style>
</head>
<body>

<!-- ── FIXED NAV ─────────────────────────────────────────────────────────── -->
<nav id="gb-nav">
  <div class="nav-pill">
    <div class="nav-logo">
      ${LOGO_SVG}
      <span>glassbox</span>
    </div>
    <div id="desktop-links">
      <button class="nav-btn on" id="nav-home"   onclick="navigate('home')">Home</button>
      <button class="nav-btn"    id="nav-logs"   onclick="navigate('logs')">Logs <span class="nav-badge">${trades.length}</span></button>
      <button class="nav-btn"    id="nav-report" onclick="navigate('report')">Report</button>
      <button class="nav-btn"    id="nav-docs"   onclick="navigate('docs')">Docs</button>
    </div>
  </div>
  <div class="nav-right">
    <a class="gh-link" href="https://github.com/IamHarrie-Labs/glass-box" target="_blank" id="gh-link">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      GitHub
    </a>
    <button id="burger-btn" onclick="toggleMenu()" aria-label="Menu">
      <span id="burger-open"><svg width="18" height="18" viewBox="0 0 18 18" stroke="white" stroke-width="1.8" fill="none"><line x1="2" y1="5" x2="16" y2="5"/><line x1="2" y1="9" x2="16" y2="9"/><line x1="2" y1="13" x2="16" y2="13"/></svg></span>
      <span id="burger-close" style="display:none"><svg width="18" height="18" viewBox="0 0 18 18" stroke="white" stroke-width="1.8" fill="none"><line x1="3" y1="3" x2="15" y2="15"/><line x1="15" y1="3" x2="3" y2="15"/></svg></span>
    </button>
  </div>
</nav>

<!-- Mobile menu -->
<div id="mobile-menu">
  <button class="mob-link" onclick="navigate('home');closeMenu()">Home</button>
  <button class="mob-link" onclick="navigate('logs');closeMenu()">Logs <span class="nav-badge" style="margin-left:6px;">${trades.length}</span></button>
  <button class="mob-link" onclick="navigate('report');closeMenu()">Report</button>
  <button class="mob-link" onclick="navigate('docs');closeMenu()">Docs</button>
  <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
    <a href="https://github.com/IamHarrie-Labs/glass-box" target="_blank" style="display:block;background:#fff;color:#06060f;font-weight:600;font-size:13px;padding:12px 20px;border-radius:100px;text-align:center;">View on GitHub</a>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE: HOME
═══════════════════════════════════════════════════════════════════════════ -->
<div id="page-home" class="page page-home">
  <section style="position:relative;height:100vh;min-height:580px;overflow:hidden;">
    <video autoplay loop muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;">
      <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260618_174853_aac61aa2-0f3f-4cf1-bc78-7f657dd11164.mp4" type="video/mp4">
    </video>
    <!-- Dark vignette -->
    <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(6,6,15,0.92) 0%,rgba(6,6,15,0.25) 55%,rgba(6,6,15,0.05) 100%);z-index:1;"></div>

    <!-- Hero content: lower portion -->
    <div style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;padding:22px 28px 44px;">
      <div style="flex:1;"></div>
      <div style="display:flex;flex-direction:row;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;">

        <!-- Left: headline + CTAs -->
        <div style="animation:fadeUp 0.8s ease-out both;max-width:560px;">
          <h1 style="font-size:clamp(1.55rem,2.8vw,2.5rem);font-weight:700;line-height:1.15;letter-spacing:-0.025em;color:#fff;margin-bottom:16px;">
            Your agent explains every trade.<br>We audit whether those explanations hold up.
          </h1>
          <p style="font-size:clamp(13px,1.2vw,14.5px);color:rgba(255,255,255,0.72);max-width:460px;line-height:1.7;margin-bottom:26px;font-weight:300;">
            Glass Box locks in your LLM trading agent's stated reasoning before outcomes are known, runs a statistical autopsy after each close, and feeds verified findings back into the agent. Real drivers stay. Decorative reasoning gets flagged. Harmful drivers get removed.
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            <button onclick="navigate('logs')" style="background:#fff;color:#06060f;font-weight:600;font-size:13.5px;padding:12px 26px;border-radius:100px;border:none;cursor:pointer;font-family:'Poppins',sans-serif;">View live logs</button>
            <button onclick="navigate('report')" style="background:rgba(255,255,255,0.1);color:#fff;font-weight:500;font-size:13.5px;padding:12px 26px;border-radius:100px;border:1px solid rgba(255,255,255,0.18);cursor:pointer;font-family:'Poppins',sans-serif;backdrop-filter:blur(8px);">Autopsy report</button>
          </div>
        </div>

        <!-- Right: stat chips -->
        <div style="display:flex;flex-direction:column;gap:7px;animation:fadeUp 0.9s ease-out 0.15s both;min-width:175px;">
          <div style="background:rgba(6,6,15,0.88);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,0.18);border-radius:12px;padding:11px 16px;">
            <div style="font-size:22px;font-weight:700;color:#fff;line-height:1;">${trades.length}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.72);margin-top:3px;font-weight:400;">Trades logged</div>
          </div>
          <div style="background:rgba(6,6,15,0.88);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,0.18);border-radius:12px;padding:11px 16px;">
            <div style="font-size:22px;font-weight:700;color:#fff;line-height:1;">${closedTrades.length}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.72);margin-top:3px;font-weight:400;">Positions closed</div>
          </div>
          <div style="background:${sdiBg};backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid ${sdiBorder};border-radius:12px;padding:11px 16px;">
            <div style="font-size:22px;font-weight:700;color:${sdiColor};line-height:1;">${sdiText}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.72);margin-top:3px;font-weight:400;">Self-Deception Index</div>
          </div>
          <div style="background:${ocgBg};backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid ${ocgBorder};border-radius:12px;padding:11px 16px;">
            <div style="font-size:22px;font-weight:700;color:${ocgColor};line-height:1;">${ocgText}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.72);margin-top:3px;font-weight:400;">Overconfidence Gap</div>
          </div>
        </div>

      </div>
    </div>
  </section>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE: LOGS
═══════════════════════════════════════════════════════════════════════════ -->
<div id="page-logs" class="page">
  <div class="inner-page">
    <div class="ph">
      <div class="ph-label">Live data</div>
      <div class="ph-title">Live trade log</div>
      <div class="ph-sub">Every decision the agent made, with its stated thesis locked in before the outcome was known.</div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:20px;">
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center;">
          <span style="font-size:10.5px;color:rgba(255,255,255,0.35);font-weight:500;letter-spacing:0.06em;text-transform:uppercase;margin-right:2px;">Driver</span>
          <button class="chip on" data-chip-driver="all"               onclick="setDriver('all')">All drivers</button>
          <button class="chip"    data-chip-driver="momentum_breakout" onclick="setDriver('momentum_breakout')">momentum_breakout</button>
          <button class="chip"    data-chip-driver="mean_reversion"    onclick="setDriver('mean_reversion')">mean_reversion</button>
          <button class="chip"    data-chip-driver="trend_follow"      onclick="setDriver('trend_follow')">trend_follow</button>
          <button class="chip"    data-chip-driver="funding_signal"    onclick="setDriver('funding_signal')">funding_signal</button>
          <button class="chip"    data-chip-driver="sentiment_extreme" onclick="setDriver('sentiment_extreme')">sentiment_extreme</button>
          <button class="chip"    data-chip-driver="breakdown_short"   onclick="setDriver('breakdown_short')">breakdown_short</button>
          <button class="chip"    data-chip-driver="news_catalyst"     onclick="setDriver('news_catalyst')">news_catalyst</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center;">
          <span style="font-size:10.5px;color:rgba(255,255,255,0.35);font-weight:500;letter-spacing:0.06em;text-transform:uppercase;margin-right:2px;">Side</span>
          <button class="chip on" data-chip-side="both"  onclick="setSide('both')">Both sides</button>
          <button class="chip"    data-chip-side="long"  onclick="setSide('long')">Long only</button>
          <button class="chip"    data-chip-side="short" onclick="setSide('short')">Short only</button>
        </div>
      </div>
      <div style="background:rgba(56,189,248,0.09);border:1px solid rgba(56,189,248,0.22);border-radius:10px;padding:10px 18px;text-align:right;">
        <div style="font-size:10.5px;color:rgba(56,189,248,0.7);margin-bottom:2px;font-weight:500;">Showing</div>
        <div id="trade-count" style="font-size:18px;font-weight:700;color:#38bdf8;">${trades.length}</div>
      </div>
    </div>

    <div class="tbl-wrap">
      <table style="min-width:820px;">
        <thead><tr>
          <th>Time</th><th>Side</th><th>Entry</th><th>Driver</th><th class="right">Conf</th><th>Rationale</th><th class="right">Result</th>
        </tr></thead>
        <tbody id="trade-body">${tradeRows()}</tbody>
      </table>
    </div>
  </div>
  ${FOOTER}
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE: REPORT
═══════════════════════════════════════════════════════════════════════════ -->
<div id="page-report" class="page">
  <div class="inner-page narrow">
    <div class="ph">
      <div class="ph-label">Autopsy report</div>
      <div class="ph-title">The engine's verdict on<br>whether stated reasoning explains results.</div>
      <div class="ph-sub" style="margin-top:12px;">${headline()}</div>
    </div>

    <!-- KPI row -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-num">${report ? report.totalTrades : "—"}</div>
        <div class="kpi-lbl">Trades analyzed</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num">${report ? pct(report.overallWinRate) : "—"}</div>
        <div class="kpi-lbl">Overall win rate</div>
      </div>
      <div class="kpi-card" style="background:${sdiBg};border-color:${sdiBorder};" title="Fraction of stated reasons that were decorative or harmful. 0% is perfect, 100% means none of the agent's stated reasons actually predicted wins.">
        <div class="kpi-num" style="color:${sdiColor};">${sdiText}</div>
        <div class="kpi-lbl">Self-Deception Index <span style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;border:1px solid rgba(255,255,255,0.3);font-size:9px;font-weight:700;vertical-align:middle;margin-left:3px;color:rgba(255,255,255,0.35);">?</span></div>
      </div>
      <div class="kpi-card" style="background:${ocgBg};border-color:${ocgBorder};" title="Average gap between stated confidence and actual win rate. A high number means the agent was systematically overconfident.">
        <div class="kpi-num" style="color:${ocgColor};">${ocgText}</div>
        <div class="kpi-lbl">Overconfidence Gap <span style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;border:1px solid rgba(255,255,255,0.3);font-size:9px;font-weight:700;vertical-align:middle;margin-left:3px;color:rgba(255,255,255,0.35);">?</span></div>
      </div>
    </div>

    <!-- Signal attribution -->
    <div class="card">
      <div class="card-title">What actually moved the PnL?</div>
      <div class="card-sub">${attrSub}</div>
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden;">
        ${signalRows()}
      </div>
    </div>

    <!-- Driver verdicts -->
    <div class="card">
      <div class="card-title">Were the stated reasons real?</div>
      <div class="card-sub">Each reason the agent cited is compared against a direction adjusted baseline: what the same long/short mix of trades won without citing that reason. This prevents a label from looking like an edge just because it rode the market's direction. The L/S column shows that mix. Significance uses a two proportion z-test.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(52,211,153,0.85);"><span style="width:8px;height:8px;border-radius:50%;background:#34d399;flex-shrink:0;"></span>real edge</span>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(251,191,36,0.85);"><span style="width:8px;height:8px;border-radius:50%;background:#fbbf24;flex-shrink:0;"></span>decorative</span>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(248,113,113,0.85);"><span style="width:8px;height:8px;border-radius:50%;background:#f87171;flex-shrink:0;"></span>harmful</span>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(255,255,255,0.35);"><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.2);flex-shrink:0;"></span>insufficient data</span>
      </div>
      <div class="tbl-wrap">
        <table style="min-width:680px;">
          <thead><tr>
            <th>Stated reason</th><th class="right">Times cited</th><th>L / S</th><th class="right">Win rate</th><th class="right">Dir adj baseline</th><th class="right">Delta</th><th>Verdict</th>
          </tr></thead>
          <tbody>${driverRows()}</tbody>
        </table>
      </div>
      ${report?.effectiveSampleNote ? `<p class="caveat">${esc(report.effectiveSampleNote)}</p>` : ""}
    </div>

    <!-- Calibration -->
    <div class="card">
      <div class="card-title">Did confidence actually mean anything?</div>
      <div class="card-sub">A well-calibrated agent wins roughly 80% of trades when it says it is 80% confident. A positive gap means it was overconfident. Confidence stated before the trade, outcome recorded after.</div>
      <div class="tbl-wrap">
        <table style="min-width:520px;">
          <thead><tr>
            <th>Confidence bucket</th><th class="right">Trades</th><th class="right">Agent said</th><th class="right">Actually won</th><th class="right">Gap</th>
          </tr></thead>
          <tbody>${calRows()}</tbody>
        </table>
      </div>
    </div>
  </div>
  ${FOOTER}
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE: DOCS
═══════════════════════════════════════════════════════════════════════════ -->
<div id="page-docs" class="page">
  <div class="inner-page narrow">
    <div class="ph">
      <div class="ph-label">Documentation</div>
      <div class="ph-title">Everything you need to install,<br>run, and understand Glass Box.</div>
    </div>

    <div class="doc-tabs">
      <button class="doc-tab on" id="dt-install"  onclick="showTab('install')">Installation</button>
      <button class="doc-tab"    id="dt-config"   onclick="showTab('config')">Configuration</button>
      <button class="doc-tab"    id="dt-commands" onclick="showTab('commands')">Commands</button>
      <button class="doc-tab"    id="dt-schema"   onclick="showTab('schema')">Schema</button>
      <button class="doc-tab"    id="dt-drivers"  onclick="showTab('drivers')">Driver tags</button>
      <button class="doc-tab"    id="dt-engine"   onclick="showTab('engine')">Engine</button>
    </div>

    <!-- Installation -->
    <div id="dp-install" class="doc-panel on">
      <h3 style="font-size:17px;font-weight:600;margin-bottom:8px;">Getting started</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:18px;line-height:1.65;">Glass Box requires Node.js 20 or later. No additional runtime dependencies.</p>
      <pre>git clone https://github.com/IamHarrie-Labs/glass-box
cd glass-box
npm install</pre>
      <p style="font-size:13px;color:rgba(255,255,255,0.45);line-height:1.65;">After install, copy <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">.env.example</code> to <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">.env</code> and add your LLM API key. Then run the agent with <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">npm run agent</code>.</p>
    </div>

    <!-- Configuration -->
    <div id="dp-config" class="doc-panel">
      <h3 style="font-size:17px;font-weight:600;margin-bottom:8px;">Configuration</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:18px;line-height:1.65;">All settings are environment variables. Copy <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">.env.example</code> to <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">.env</code> to get started. Swap LLM providers by updating the three <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">LLM_*</code> vars. No code changes needed.</p>
      <pre># LLM provider (any OpenAI-compatible endpoint)
LLM_API_KEY=your-key-here
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.1-8b-instant

# Tick interval in seconds
# 120 = one call every 2 minutes (safe for free-tier rate limits)
TICK_SECONDS=120

# Assets to trade, rotated one per tick.
# Multiple assets prevent the real driver finding from being a
# single-asset tautology (e.g. BTC predicting BTC).
SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT

# Round-trip trading friction in basis points (fee + slippage).
# Applied to every closed position to keep paper PnL honest.
# Default 6 bps. Set to 0 to disable.
FRICTION_BPS=6

# GitHub persistence (optional, for live Vercel site updates)
GITHUB_TOKEN=your-classic-pat
GITHUB_REPO=IamHarrie-Labs/glass-box
GITHUB_BRANCH=master</pre>
    </div>

    <!-- Commands -->
    <div id="dp-commands" class="doc-panel">
      <h3 style="font-size:17px;font-weight:600;margin-bottom:16px;">Commands</h3>
      <div class="cmd-list">
        ${[
          ["npm run agent",   "Starts the live paper-trading loop. Fetches Bitget market data every TICK_SECONDS, asks the LLM to reason, locks in the stated thesis, and writes a decision record. Rotates through SYMBOLS one per tick. Runs continuously until stopped."],
          ["npm run autopsy", "Reads data/trades.jsonl, closes any matured open positions at the last known price, then runs the three autopsy analyses (signal attribution, self-deception detection, confidence calibration). Writes data/report.json."],
          ["npm run site",    "Reads data/trades.jsonl and data/report.json and regenerates docs/index.html with all live data embedded. Deploy the docs folder to any static host."],
          ["npm run report",  "Generates data/report.html, a standalone single-file audit report. Open in any browser, no server needed."],
          ["npm run demo",    "Seeds synthetic trade data, runs autopsy, and builds the report. Fully offline. No API keys or network connection required."],
        ].map(([cmd, desc]) => `<div class="cmd-card"><code>${cmd}</code><p>${desc}</p></div>`).join("")}
      </div>
    </div>

    <!-- Schema -->
    <div id="dp-schema" class="doc-panel">
      <h3 style="font-size:17px;font-weight:600;margin-bottom:8px;">Decision record schema</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:18px;line-height:1.65;">Every trade the agent opens is written to <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">data/trades.jsonl</code> as one JSON object per line. The stated thesis is recorded before the position opens. Outcome fields are filled in at close. Any external agent that writes this schema can be audited by Glass Box without modifying agent code.</p>
      <pre>{
  "tradeId": "t_51bfe01c",
  "timestamp": "2026-06-23T09:17:09.000Z",
  "pair": "BTCUSDT",
  "side": "long",
  "entryPrice": 62446.5,
  "sizeUsd": 1000,
  "statedThesis": {
    "primaryDriver": "mean_reversion",
    "supportingSignals": ["rsi_oversold", "funding_negative"],
    "confidence": 0.70,
    "naturalLanguage": "Market is oversold and due for a bounce..."
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
}</pre>
    </div>

    <!-- Driver tags -->
    <div id="dp-drivers" class="doc-panel">
      <h3 style="font-size:17px;font-weight:600;margin-bottom:8px;">Driver tags</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:20px;line-height:1.65;">The LLM is constrained to map its reasoning onto this closed enum before each trade. Free-text rationale cannot be aggregated across trades statistically. A closed enum can be. This is what makes the self-deception analysis possible.</p>
      <div class="tag-list">
        ${[
          ["momentum_breakout", "#38bdf8", "Price breaking a level with volume or trend confirmation"],
          ["mean_reversion",    "#a78bfa", "Price has overshot and is likely to revert toward the mean"],
          ["trend_follow",      "#fbbf24", "Established trend continuation with momentum behind it"],
          ["sentiment_extreme", "#f87171", "Fear and Greed index or positioning at a historical extreme"],
          ["funding_signal",    "#34d399", "Funding rate imbalance indicating a crowded one-sided position"],
          ["breakdown_short",   "#fb923c", "Support break with downside momentum confirming the move"],
          ["news_catalyst",     "rgba(255,255,255,0.65)", "Identifiable news or macro event driving price action"],
        ].map(([tag, color, desc]) => `<div class="tag-row"><code style="color:${color};">${tag}</code><span>${desc}</span></div>`).join("")}
      </div>
      <p style="font-size:12.5px;color:rgba(255,255,255,0.35);margin-top:16px;line-height:1.6;">The autopsy feedback loop removes only <strong style="color:rgba(255,255,255,0.55);">harmful</strong> drivers from the agent's allowed set after each analysis. Decorative and untested drivers remain so the comparison group stays valid and the baseline does not collapse.</p>
    </div>

    <!-- Engine -->
    <div id="dp-engine" class="doc-panel">
      <h3 style="font-size:17px;font-weight:600;margin-bottom:16px;">Engine methodology</h3>
      <div class="cmd-list">
        ${[
          ["Signal attribution",
           "Pearson correlation of each objective market feature (RSI, 1h return, 24h return, funding rate, Fear and Greed, volatility) with realized PnL. Answers: what actually predicted your winners, regardless of what the agent said? PnL is net of round-trip trading friction (FRICTION_BPS)."],
          ["Self-deception detection",
           "For each driver the agent cited, its win rate is compared against a direction adjusted baseline: what the same long/short mix of other trades won without citing that driver. This prevents a label from appearing to have edge simply because it was used when the market happened to be rising. Significance is tested with a two proportion z-test. No real lift produces a decorative verdict. Significant negative lift produces a harmful verdict. Significant positive lift produces a real edge verdict."],
          ["Confidence calibration",
           "Trades are grouped by stated confidence bucket (0 to 0.6, 0.6 to 0.75, etc.) and stated confidence is compared against the actual win rate within each bucket. The Overconfidence Gap is the average spread between what the agent claimed and what happened."],
          ["Autopsy feedback loop",
           "After each autopsy, the verified findings are injected into the agent's system prompt for the next tick. Harmful drivers are removed from the allowed DriverTag enum so the agent cannot cite them again. Decorative drivers remain: removing them would collapse the comparison group and make future baselines invalid."],
          ["Multi-asset rotation",
           "The agent rotates through BTCUSDT, ETHUSDT, and SOLUSDT one per tick. This prevents the signal attribution finding from being a single-asset tautology (e.g. BTC price predicting BTC trades, which is trivially true)."],
          ["Honesty caveat",
           "Trades on one asset that open minutes apart and are held for hours have overlapping windows, so outcomes are not fully independent. The report says so explicitly and treats z-scores as directional rather than strict p-values. The effectiveSampleNote field in the report spells this out per driver."],
        ].map(([name, desc]) => `<div class="cmd-card"><code style="color:rgba(255,255,255,0.8);font-size:13px;">${name}</code><p>${desc}</p></div>`).join("")}
      </div>
    </div>

  </div>
  ${FOOTER}
</div>

<script>
// ── SPA router ────────────────────────────────────────────────────────────────
const PAGES = ['home','logs','report','docs'];
const NAV_IDS = { home:'nav-home', logs:'nav-logs', report:'nav-report', docs:'nav-docs' };

function navigate(page) {
  if (!PAGES.includes(page)) page = 'home';
  PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = p === page ? 'block' : 'none';
  });
  Object.entries(NAV_IDS).forEach(([p, id]) => {
    const btn = document.getElementById(id);
    if (btn) { btn.classList.toggle('on', p === page); }
  });
  const url = page === 'home' ? '/' : '/' + page;
  history.pushState({ page }, '', url);
  window.scrollTo(0, 0);
}

window.addEventListener('popstate', e => {
  navigate(e.state?.page || pathToPage());
});

function pathToPage() {
  const p = window.location.pathname.replace(/^\//, '') || 'home';
  return PAGES.includes(p) ? p : 'home';
}

// Initial load
navigate(pathToPage());

// ── Nav scroll ────────────────────────────────────────────────────────────────
const gbNav = document.getElementById('gb-nav');
window.addEventListener('scroll', () => {
  gbNav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── Mobile nav ─────────────────────────────────────────────────────────────────
function applyNavLayout() {
  const mob = window.innerWidth < 768;
  document.getElementById('desktop-links').style.display = mob ? 'none' : 'flex';
  document.getElementById('gh-link').style.display       = mob ? 'none' : 'inline-flex';
  document.getElementById('burger-btn').style.display    = mob ? 'flex' : 'none';
}
applyNavLayout();
window.addEventListener('resize', applyNavLayout);

let menuOpen = false;
function toggleMenu() {
  menuOpen = !menuOpen;
  document.getElementById('mobile-menu').style.display  = menuOpen ? 'flex' : 'none';
  document.getElementById('burger-open').style.display  = menuOpen ? 'none' : 'inline';
  document.getElementById('burger-close').style.display = menuOpen ? 'inline' : 'none';
}
function closeMenu() {
  menuOpen = false;
  document.getElementById('mobile-menu').style.display  = 'none';
  document.getElementById('burger-open').style.display  = 'inline';
  document.getElementById('burger-close').style.display = 'none';
}

// ── Trade filters ─────────────────────────────────────────────────────────────
let activeDriver = 'all', activeSide = 'both';

function setDriver(d) { activeDriver = d; applyFilters(); }
function setSide(s)   { activeSide   = s; applyFilters(); }

function applyFilters() {
  let count = 0;
  document.querySelectorAll('#trade-body tr[data-driver]').forEach(row => {
    const show = (activeDriver === 'all' || row.dataset.driver === activeDriver)
              && (activeSide   === 'both' || row.dataset.side   === activeSide);
    row.style.display = show ? '' : 'none';
    if (show) count++;
  });
  const el = document.getElementById('trade-count');
  if (el) el.textContent = count;
  document.querySelectorAll('[data-chip-driver]').forEach(b => {
    b.classList.toggle('on', b.dataset.chipDriver === activeDriver);
  });
  document.querySelectorAll('[data-chip-side]').forEach(b => {
    b.classList.toggle('on', b.dataset.chipSide === activeSide);
  });
}

// ── Doc tabs ──────────────────────────────────────────────────────────────────
const DOC_TABS = ['install','config','commands','schema','drivers','engine'];

function showTab(t) {
  DOC_TABS.forEach(id => {
    const panel = document.getElementById('dp-' + id);
    const btn   = document.getElementById('dt-' + id);
    if (panel) panel.classList.toggle('on', id === t);
    if (btn)   btn.classList.toggle('on', id === t);
  });
}
</script>
</body>
</html>`;

mkdirSync("docs", { recursive: true });
writeFileSync("docs/index.html", HTML, "utf8");
// Tell GitHub Pages to serve docs/ verbatim (skip Jekyll, which chokes on the
// embedded JS template literals and slows builds).
writeFileSync("docs/.nojekyll", "", "utf8");
// SPA fallback: GitHub Pages serves 404.html for unknown paths. Pointing it at
// the same app lets /logs, /report, /docs resolve on direct navigation/reload.
writeFileSync("docs/404.html", HTML, "utf8");
console.log(`Wrote docs/index.html + 404.html + .nojekyll (${trades.length} trades, report: ${report ? "yes" : "no"})`);
