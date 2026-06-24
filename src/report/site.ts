/**
 * `npm run site` — generates docs/index.html.
 * Dark-themed single-page site based on the Glassbox.dc.html design.
 * All DCLogic template vars replaced with live embedded data.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
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
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const closedTrades = trades.filter((t) => t.outcome);

// SDI color: red if > 50%, amber if 20-50%, green if low
const sdiColor = report
  ? report.selfDeceptionIndex > 0.5 ? "#f87171" : report.selfDeceptionIndex > 0.2 ? "#fbbf24" : "#34d399"
  : "#fff";
const sdiAccent = report
  ? report.selfDeceptionIndex > 0.5 ? "rgba(248,113,113,0.3)" : report.selfDeceptionIndex > 0.2 ? "rgba(251,191,36,0.25)" : "rgba(52,211,153,0.3)"
  : "rgba(255,255,255,0.1)";
const sdiCardBorder = report
  ? report.selfDeceptionIndex > 0.5 ? "rgba(248,113,113,0.15)" : report.selfDeceptionIndex > 0.2 ? "rgba(251,191,36,0.15)" : "rgba(52,211,153,0.15)"
  : "rgba(255,255,255,0.08)";
const sdiCardBg = report
  ? report.selfDeceptionIndex > 0.5 ? "rgba(248,113,113,0.06)" : report.selfDeceptionIndex > 0.2 ? "rgba(251,191,36,0.06)" : "rgba(52,211,153,0.06)"
  : "rgba(255,255,255,0.04)";

const ocgColor = report ? (report.overconfidenceGap > 0.1 ? "#fbbf24" : "#34d399") : "#fff";
const ocgCardBg = report ? (report.overconfidenceGap > 0.1 ? "rgba(251,191,36,0.06)" : "rgba(52,211,153,0.06)") : "rgba(255,255,255,0.04)";
const ocgCardBorder = report ? (report.overconfidenceGap > 0.1 ? "rgba(251,191,36,0.15)" : "rgba(52,211,153,0.15)") : "rgba(255,255,255,0.08)";

// ── driver colors ────────────────────────────────────────────────────────────
const DRIVER_COLORS: Record<string, { bg: string; color: string }> = {
  momentum_breakout: { bg: "rgba(56,189,248,0.12)",  color: "#38bdf8" },
  mean_reversion:    { bg: "rgba(167,139,250,0.12)", color: "#a78bfa" },
  trend_follow:      { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
  funding_signal:    { bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  sentiment_extreme: { bg: "rgba(248,113,113,0.12)", color: "#f87171" },
  breakdown_short:   { bg: "rgba(251,146,60,0.12)",  color: "#fb923c" },
  news_catalyst:     { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" },
};

// ── builders ─────────────────────────────────────────────────────────────────
function buildTradeRows(): string {
  if (!trades.length) {
    return `<tr><td colspan="7" style="text-align:center;padding:48px 16px;color:rgba(255,255,255,0.35);font-size:14px;">No trades logged yet. Run <code style="font-family:'Courier New',monospace;background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">npm run agent</code> to start.</td></tr>`;
  }
  return [...trades]
    .reverse()
    .map((t) => {
      const dc = DRIVER_COLORS[t.statedThesis.primaryDriver] || DRIVER_COLORS.news_catalyst;
      const tsStr = new Date(t.timestamp).toLocaleString("en-GB", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
      const sideColor = t.side === "long" ? "#34d399" : "#f87171";
      const raw = esc(t.statedThesis.naturalLanguage);
      const shortRat = raw.length > 72 ? raw.slice(0, 72) + "…" : raw;

      let resultHtml: string;
      if (!t.outcome) {
        resultHtml = `<span style="color:rgba(255,255,255,0.35);font-weight:500;font-size:13px;">open</span>`;
      } else {
        const p = t.outcome.pnlUsd;
        const c = p >= 0 ? "#34d399" : "#f87171";
        resultHtml = `<span style="color:${c};font-weight:600;font-size:13px;">${p >= 0 ? "+" : ""}$${Math.abs(p).toFixed(0)}</span>`;
      }

      return `<tr data-driver="${esc(t.statedThesis.primaryDriver)}" data-side="${t.side}">
        <td style="padding:13px 16px;font-size:12px;color:rgba(255,255,255,0.5);white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.04);">${tsStr}</td>
        <td style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${sideColor};">${t.side === "long" ? "LONG" : "SHORT"}</td>
        <td style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:rgba(255,255,255,0.75);white-space:nowrap;font-variant-numeric:tabular-nums;">$${t.entryPrice.toFixed(1)}</td>
        <td style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="background:${dc.bg};color:${dc.color};padding:2px 8px;border-radius:5px;font-size:11px;font-family:'Courier New',monospace;white-space:nowrap;">${esc(t.statedThesis.primaryDriver)}</span></td>
        <td style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:rgba(255,255,255,0.6);">${(t.statedThesis.confidence * 100).toFixed(0)}%</td>
        <td style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;color:rgba(255,255,255,0.45);max-width:300px;line-height:1.5;">${shortRat}</td>
        <td style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">${resultHtml}</td>
      </tr>`;
    })
    .join("");
}

function buildSignalRows(): string {
  if (!report?.attribution?.length)
    return `<div style="padding:24px;text-align:center;color:rgba(255,255,255,0.35);">No signal data yet. Run <code style="font-family:'Courier New',monospace;background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">npm run autopsy</code>.</div>`;

  const maxCorr = Math.max(...report.attribution.map((a) => Math.abs(a.correlationWithPnl)));
  return report.attribution
    .map((a) => {
      const isPos = a.correlationWithPnl >= 0;
      const barPct = maxCorr > 0 ? ((Math.abs(a.correlationWithPnl) / maxCorr) * 100).toFixed(1) : "0";
      const barColor = isPos ? "linear-gradient(90deg,#38bdf8,#0ea5e9)" : "linear-gradient(90deg,#f87171,#ef4444)";
      const corrLabel = (a.correlationWithPnl >= 0 ? "+" : "") + a.correlationWithPnl.toFixed(2);
      return `<div style="display:flex;align-items:center;gap:16px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="font-family:'Courier New',monospace;font-size:12px;color:rgba(255,255,255,0.65);width:130px;flex-shrink:0;">${esc(a.feature)}</span>
        <div style="flex:1;background:rgba(255,255,255,0.07);border-radius:4px;height:7px;overflow:hidden;">
          <div style="width:${barPct}%;height:7px;border-radius:4px;background:${barColor};"></div>
        </div>
        <span style="color:${isPos ? "#38bdf8" : "#f87171"};font-size:13px;font-weight:600;width:44px;text-align:right;flex-shrink:0;font-family:'Courier New',monospace;">${corrLabel}</span>
      </div>`;
    })
    .join("");
}

function buildDriverRows(): string {
  if (!report?.drivers?.length)
    return `<tr><td colspan="7" style="text-align:center;padding:40px;color:rgba(255,255,255,0.35);">No driver data yet.</td></tr>`;

  const VERDICT: Record<string, { bg: string; color: string; label: string }> = {
    decorative:        { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24", label: "decorative" },
    real_edge:         { bg: "rgba(52,211,153,0.12)",  color: "#34d399", label: "real edge" },
    harmful:           { bg: "rgba(248,113,113,0.12)", color: "#f87171", label: "harmful" },
    insufficient_data: { bg: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", label: "insufficient data" },
  };

  return report.drivers
    .map((d) => {
      const v = VERDICT[d.verdict] ?? VERDICT.decorative;
      const edgePp = (d.edge * 100).toFixed(1);
      const edgeSign = d.edge >= 0 ? "+" : "";
      const diffColor = d.edge > 0.02 ? "#34d399" : d.edge < -0.02 ? "#f87171" : "rgba(255,255,255,0.4)";
      const ls = `${d.longCited ?? 0}L / ${d.shortCited ?? 0}S`;
      return `<tr>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);"><code style="font-family:'Courier New',monospace;font-size:11px;background:rgba(255,255,255,0.07);padding:2px 7px;border-radius:4px;color:rgba(255,255,255,0.75);">${esc(d.driver)}</code></td>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;font-size:13px;color:rgba(255,255,255,0.6);">${d.timesCited}×</td>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;color:rgba(255,255,255,0.45);">${ls}</td>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;font-size:13px;font-weight:500;color:rgba(255,255,255,0.8);">${pct(d.winRateWhenCited)}</td>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;font-size:13px;color:rgba(255,255,255,0.4);">${pct(d.baselineWinRate)}</td>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;"><span style="color:${diffColor};font-weight:600;font-size:13px;">${edgeSign}${edgePp}pp</span></td>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="background:${v.bg};color:${v.color};padding:2px 9px;border-radius:100px;font-size:11px;font-weight:500;white-space:nowrap;">${v.label}</span></td>
      </tr>`;
    })
    .join("");
}

function buildCalRows(): string {
  if (!report?.calibration?.length)
    return `<tr><td colspan="5" style="text-align:center;padding:40px;color:rgba(255,255,255,0.35);">No calibration data yet.</td></tr>`;

  return report.calibration
    .map((c) => {
      const over = c.gap > 0.1;
      const gapStr = (c.gap > 0 ? "+" : "") + (c.gap * 100).toFixed(1) + "pp" + (over ? " ← overconfident" : "");
      return `<tr>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;font-family:'Courier New',monospace;color:rgba(255,255,255,0.7);">${esc(c.label)}</td>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;font-size:13px;color:rgba(255,255,255,0.55);">${c.trades}</td>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;font-size:13px;color:rgba(255,255,255,0.7);">${pct(c.avgConfidence)}</td>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;"><span style="color:${c.actualWinRate > 0.5 ? "#34d399" : "#f87171"};font-weight:500;font-size:13px;">${pct(c.actualWinRate)}</span></td>
        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;"><span style="color:${over ? "#f87171" : "#34d399"};font-weight:600;font-size:13px;">${gapStr}</span></td>
      </tr>`;
    })
    .join("");
}

function buildHeadline(): string {
  if (!report) return "No autopsy data yet. Run <code>npm run autopsy</code>.";
  const topDriver = [...report.drivers].sort((a, b) => b.timesCited - a.timesCited)[0];
  const topAttr = report.attribution[0];
  if (!topDriver || !topAttr) return esc(report.headline);
  const citedWr = pct(topDriver.winRateWhenCited);
  const baseWr = pct(topDriver.baselineWinRate);
  const corr = topAttr.correlationWithPnl.toFixed(2);
  return `The agent's most-cited reason "<strong style="color:rgba(255,255,255,0.85);">${esc(topDriver.driver)}</strong>" is ${esc(topDriver.verdict.replace(/_/g, " "))} (${citedWr} win vs ${baseWr} baseline). Its PnL is really driven by <strong style="color:rgba(255,255,255,0.85);">${esc(topAttr.feature)}</strong> (corr ${corr}).`;
}

const assetLine = report?.assets?.length ? ` Across ${report.assets.length} asset(s): ${report.assets.join(", ")}.` : "";
const attrLeadText = report?.attribution?.[0]
  ? `The strongest predictor of the agent's profits was <strong style="color:rgba(255,255,255,0.75);">${esc(report.attribution[0].feature)}</strong> (correlation ${report.attribution[0].correlationWithPnl.toFixed(2)}). Blue = predicted wins. Red = predicted losses. PnL is net of round-trip trading friction.${assetLine}`
  : "Run autopsy to see signal attribution.";

// ── full HTML ─────────────────────────────────────────────────────────────────
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Glass Box · Agent Autopsy Engine</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://db.onlinewebfonts.com/c/304a6edcec9f8858eeaafc2ac18243f4?family=Askan+Light" rel="stylesheet" type="text/css">
<style>
@keyframes fadeUp { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
* { box-sizing:border-box; margin:0; padding:0; }
html { scroll-behavior:smooth; }
body { font-family:'Inter',sans-serif; background:#06060f; color:#fff; -webkit-font-smoothing:antialiased; overflow-x:hidden; }
::-webkit-scrollbar { width:3px; }
::-webkit-scrollbar-track { background:#06060f; }
::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:2px; }
a { text-decoration:none; }
table { width:100%; border-collapse:collapse; }
code { font-family:'Courier New',monospace; }
</style>
</head>
<body>

<!-- ── FIXED NAV ──────────────────────────────────────────────────────────── -->
<nav id="gb-nav" style="position:fixed;top:0;left:0;right:0;z-index:100;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;background:transparent;border-bottom:1px solid transparent;transition:background 0.3s,border-color 0.3s;">
  <div style="display:flex;align-items:center;background:rgba(0,0,0,0.28);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:9px 20px;">
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" style="flex-shrink:0;">
      <polygon points="10,2 18,6 10,10 2,6" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.75)" stroke-width="0.7" stroke-linejoin="round"/>
      <polygon points="2,6 10,10 10,18 2,14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.75)" stroke-width="0.7" stroke-linejoin="round"/>
      <polygon points="10,10 18,6 18,14 10,18" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.75)" stroke-width="0.7" stroke-linejoin="round"/>
    </svg>
    <span style="font-family:'Askan Light',Georgia,serif;color:#fff;font-size:16px;letter-spacing:0.07em;margin-left:8px;white-space:nowrap;">glassbox</span>
    <div id="desktop-nav" style="display:flex;gap:2px;margin-left:28px;">
      <a href="#home"   id="nav-home"   style="color:#fff;background:rgba(255,255,255,0.1);padding:5px 12px;border-radius:8px;font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;">Home</a>
      <a href="#logs"   id="nav-logs"   style="color:rgba(255,255,255,0.58);background:transparent;padding:5px 12px;border-radius:8px;font-size:13px;font-weight:400;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;">Logs <span style="font-size:10px;background:rgba(56,189,248,0.18);color:#38bdf8;padding:1px 6px;border-radius:4px;">${trades.length}</span></a>
      <a href="#report" id="nav-report" style="color:rgba(255,255,255,0.58);background:transparent;padding:5px 12px;border-radius:8px;font-size:13px;font-weight:400;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;">Report</a>
      <a href="#docs"   id="nav-docs"   style="color:rgba(255,255,255,0.58);background:transparent;padding:5px 12px;border-radius:8px;font-size:13px;font-weight:400;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;">Docs</a>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;">
    <a id="gh-btn" href="https://github.com/IamHarrie-Labs/glass-box" target="_blank" style="display:inline-flex;align-items:center;background:#fff;color:#06060f;font-weight:600;font-size:13px;padding:9px 18px;border-radius:100px;letter-spacing:0.01em;">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style="margin-right:5px;flex-shrink:0;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      GitHub
    </a>
    <button id="burger-btn" onclick="toggleMenu()" style="display:none;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 10px;cursor:pointer;align-items:center;justify-content:center;" aria-label="Menu">
      <span id="burger-open"><svg width="18" height="18" viewBox="0 0 18 18" stroke="white" stroke-width="1.8" fill="none"><line x1="2" y1="5" x2="16" y2="5"/><line x1="2" y1="9" x2="16" y2="9"/><line x1="2" y1="13" x2="16" y2="13"/></svg></span>
      <span id="burger-close" style="display:none;"><svg width="18" height="18" viewBox="0 0 18 18" stroke="white" stroke-width="1.8" fill="none"><line x1="3" y1="3" x2="15" y2="15"/><line x1="15" y1="3" x2="3" y2="15"/></svg></span>
    </button>
  </div>
</nav>

<!-- Mobile menu -->
<div id="gb-mobile-menu" style="display:none;position:fixed;top:72px;left:12px;right:12px;z-index:99;background:rgba(6,6,15,0.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:16px;flex-direction:column;gap:4px;">
  <a href="#home"   onclick="closeMenu()" style="color:rgba(255,255,255,0.75);font-size:15px;padding:12px 16px;border-radius:10px;display:block;">Home</a>
  <a href="#logs"   onclick="closeMenu()" style="color:rgba(255,255,255,0.75);font-size:15px;padding:12px 16px;border-radius:10px;display:block;">Logs <span style="font-size:10px;background:rgba(56,189,248,0.2);color:#38bdf8;padding:1px 6px;border-radius:4px;margin-left:4px;">${trades.length}</span></a>
  <a href="#report" onclick="closeMenu()" style="color:rgba(255,255,255,0.75);font-size:15px;padding:12px 16px;border-radius:10px;display:block;">Report</a>
  <a href="#docs"   onclick="closeMenu()" style="color:rgba(255,255,255,0.75);font-size:15px;padding:12px 16px;border-radius:10px;display:block;">Docs</a>
  <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.07);">
    <a href="https://github.com/IamHarrie-Labs/glass-box" target="_blank" style="display:block;background:white;color:#06060f;font-weight:600;font-size:13px;padding:12px 20px;border-radius:100px;text-align:center;">View on GitHub</a>
  </div>
</div>

<!-- ── HERO ──────────────────────────────────────────────────────────────────── -->
<section id="home" style="position:relative;height:100vh;min-height:600px;overflow:hidden;scroll-margin-top:80px;">
  <video autoplay loop muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center center;">
    <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260618_174853_aac61aa2-0f3f-4cf1-bc78-7f657dd11164.mp4" type="video/mp4">
  </video>
  <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(6,6,15,0.85) 0%,rgba(6,6,15,0.1) 50%,transparent 100%);z-index:1;"></div>
  <div style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;padding:24px 28px 40px;">
    <div style="flex:1;"></div>
    <div style="display:flex;flex-direction:row;align-items:flex-end;justify-content:space-between;gap:32px;flex-wrap:wrap;">
      <div style="animation:fadeUp 0.9s ease-out both;max-width:680px;">
        <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(0,0,0,0.3);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);border-radius:100px;padding:6px 14px;margin-bottom:24px;">
          <span style="width:6px;height:6px;border-radius:50%;background:#38bdf8;display:inline-block;"></span>
          <span style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.04em;">Track 2 · Trading Infra · Bitget AI Hackathon S1</span>
        </div>
        <h1 style="font-family:'Askan Light',Georgia,serif;font-size:clamp(2.4rem,6vw,5rem);line-height:1.02;letter-spacing:-0.02em;color:#fff;margin-bottom:20px;">Your agent sounds confident.<br>We check if it's right.</h1>
        <p style="font-size:clamp(14px,1.5vw,17px);color:rgba(255,255,255,0.68);max-width:480px;line-height:1.65;margin-bottom:28px;">Glass Box measures the gap between what an LLM trading agent <em>says</em> drove its decision and what actually drove its PnL. We call that gap the Self-Deception Index.</p>
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
          <a href="#logs" style="background:#fff;color:#06060f;font-weight:600;font-size:14px;padding:13px 28px;border-radius:100px;letter-spacing:0.01em;">View live logs</a>
          <a href="#docs" style="background:rgba(255,255,255,0.1);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font-weight:500;font-size:14px;padding:13px 28px;border-radius:100px;border:1px solid rgba(255,255,255,0.15);">Read the docs</a>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;animation:fadeUp 1s ease-out 0.2s both;min-width:180px;">
        <div style="background:rgba(0,0,0,0.3);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 16px;">
          <div style="font-family:'Askan Light',Georgia,serif;font-size:22px;color:#fff;letter-spacing:-0.02em;">${trades.length}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:2px;">Trades logged</div>
        </div>
        <div style="background:rgba(0,0,0,0.3);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 16px;">
          <div style="font-family:'Askan Light',Georgia,serif;font-size:22px;color:#fff;letter-spacing:-0.02em;">${closedTrades.length}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:2px;">Positions closed</div>
        </div>
        <div style="background:rgba(0,0,0,0.3);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid ${sdiAccent};border-radius:12px;padding:12px 16px;">
          <div style="font-family:'Askan Light',Georgia,serif;font-size:22px;color:${sdiColor};letter-spacing:-0.02em;">${report ? pct(report.selfDeceptionIndex) : "—"}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:2px;">Self-deception index</div>
        </div>
        <div style="background:rgba(0,0,0,0.3);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid ${ocgCardBorder};border-radius:12px;padding:12px 16px;">
          <div style="font-family:'Askan Light',Georgia,serif;font-size:22px;color:${ocgColor};letter-spacing:-0.02em;">${report ? pct(report.overconfidenceGap) : "—"}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:2px;">Overconfidence gap</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── HOW IT WORKS ──────────────────────────────────────────────────────────── -->
<section id="howitworks" style="background:#08081a;padding:96px 28px;scroll-margin-top:80px;">
  <div style="max-width:1100px;margin:0 auto;">
    <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#38bdf8;margin-bottom:12px;font-weight:500;">How it works</p>
    <h2 style="font-family:'Askan Light',Georgia,serif;font-size:clamp(1.8rem,4vw,3rem);line-height:1.08;letter-spacing:-0.01em;margin-bottom:12px;">Two systems. One surfaces<br>reasoning. The other audits it.</h2>
    <p style="font-size:15px;color:rgba(255,255,255,0.55);margin-bottom:56px;max-width:480px;line-height:1.6;">Every decision the agent makes is locked in before the outcome. Then the autopsy engine tears it apart.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;">

      <!-- Without Glass Box -->
      <div style="background:rgba(248,113,113,0.04);border:1px solid rgba(248,113,113,0.12);border-radius:20px;padding:32px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#f87171;flex-shrink:0;"></div>
          <span style="font-size:12px;font-weight:600;color:#f87171;letter-spacing:0.06em;text-transform:uppercase;">Without Glass Box</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:0;">
          ${[
            ["?", "Agent trades", "Produces confident natural-language rationale per trade"],
            ["!", "Story is accepted", '"Going long — momentum breakout with bullish funding"'],
            ["≈", "No verification", "Nobody checks if that reason actually predicted the outcome"],
            ["↘", "Silent drift", "Agent cites decorative reasons while losing on hidden drivers"],
            ["✕", "No insight", "You only learn what went wrong after the losses add up"],
          ].map(([icon, title, body], i, arr) => `
          <div style="display:flex;gap:16px;${i < arr.length - 1 ? "padding-bottom:24px;" : ""}">
            <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
              <div style="width:32px;height:32px;border-radius:50%;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.2);display:flex;align-items:center;justify-content:center;font-size:13px;color:#f87171;">${icon}</div>
              ${i < arr.length - 1 ? '<div style="width:1px;flex:1;background:rgba(248,113,113,0.12);margin-top:8px;"></div>' : ""}
            </div>
            <div style="padding-top:4px;">
              <div style="font-size:13px;font-weight:500;color:#fff;margin-bottom:4px;">${title}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.55;">${body}</div>
            </div>
          </div>`).join("")}
        </div>
      </div>

      <!-- With Glass Box -->
      <div style="background:rgba(56,189,248,0.04);border:1px solid rgba(56,189,248,0.15);border-radius:20px;padding:32px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#38bdf8;flex-shrink:0;"></div>
          <span style="font-size:12px;font-weight:600;color:#38bdf8;letter-spacing:0.06em;text-transform:uppercase;">With Glass Box</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:0;">
          ${[
            ["?", "Agent trades", "Produces confident natural-language rationale per trade"],
            ["⬡", "Thesis locked", "Decision record written before outcome — agent cannot revise it"],
            ["⊕", "Autopsy engine runs", "Signal attribution · Self-deception detection · Confidence calibration"],
            ["◎", "Verdicts issued", "Each stated driver scored: real edge / decorative / harmful"],
            ["↺", "Agent improves", "Self-Deception Index tracked over time. Drift caught early."],
          ].map(([icon, title, body], i, arr) => `
          <div style="display:flex;gap:16px;${i < arr.length - 1 ? "padding-bottom:24px;" : ""}">
            <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
              <div style="width:32px;height:32px;border-radius:50%;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.25);display:flex;align-items:center;justify-content:center;font-size:13px;color:#38bdf8;">${icon}</div>
              ${i < arr.length - 1 ? '<div style="width:1px;flex:1;background:rgba(56,189,248,0.12);margin-top:8px;"></div>' : ""}
            </div>
            <div style="padding-top:4px;">
              <div style="font-size:13px;font-weight:500;color:#fff;margin-bottom:4px;">${title}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.55;">${body}</div>
            </div>
          </div>`).join("")}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── LIVE TRADE LOG ─────────────────────────────────────────────────────────── -->
<section id="logs" style="background:#06060f;padding:96px 28px;scroll-margin-top:80px;">
  <div style="max-width:1200px;margin:0 auto;">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:36px;">
      <div>
        <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#38bdf8;margin-bottom:12px;font-weight:500;">Live data</p>
        <h2 style="font-family:'Askan Light',Georgia,serif;font-size:clamp(1.6rem,3.5vw,2.6rem);line-height:1.1;letter-spacing:-0.01em;">Live trade log</h2>
        <p style="font-size:14px;color:rgba(255,255,255,0.45);margin-top:8px;line-height:1.55;">Every decision the agent made, with its stated thesis locked in before the outcome was known.</p>
      </div>
      <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.2);border-radius:10px;padding:12px 20px;text-align:right;">
        <div style="font-size:11px;color:rgba(56,189,248,0.7);margin-bottom:2px;">Showing</div>
        <div id="trade-count" style="font-size:18px;font-weight:700;color:#38bdf8;">${trades.length}</div>
      </div>
    </div>

    <!-- Filters -->
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <span style="font-size:11px;color:rgba(255,255,255,0.35);font-weight:500;margin-right:4px;letter-spacing:0.04em;text-transform:uppercase;">Driver</span>
        <button data-chip-driver="all"               onclick="setDriver('all')"               style="">All drivers</button>
        <button data-chip-driver="momentum_breakout" onclick="setDriver('momentum_breakout')" style="">momentum_breakout</button>
        <button data-chip-driver="mean_reversion"    onclick="setDriver('mean_reversion')"    style="">mean_reversion</button>
        <button data-chip-driver="trend_follow"      onclick="setDriver('trend_follow')"      style="">trend_follow</button>
        <button data-chip-driver="funding_signal"    onclick="setDriver('funding_signal')"    style="">funding_signal</button>
        <button data-chip-driver="sentiment_extreme" onclick="setDriver('sentiment_extreme')" style="">sentiment_extreme</button>
        <button data-chip-driver="breakdown_short"   onclick="setDriver('breakdown_short')"   style="">breakdown_short</button>
        <button data-chip-driver="news_catalyst"     onclick="setDriver('news_catalyst')"     style="">news_catalyst</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <span style="font-size:11px;color:rgba(255,255,255,0.35);font-weight:500;margin-right:4px;letter-spacing:0.04em;text-transform:uppercase;">Side</span>
        <button data-chip-side="both"  onclick="setSide('both')"  style="">Both sides</button>
        <button data-chip-side="long"  onclick="setSide('long')"  style="">Long only</button>
        <button data-chip-side="short" onclick="setSide('short')" style="">Short only</button>
      </div>
    </div>

    <div style="overflow-x:auto;border-radius:16px;border:1px solid rgba(255,255,255,0.07);">
      <table style="min-width:820px;">
        <thead>
          <tr style="background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);">
            <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;">Time</th>
            <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Side</th>
            <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;">Entry</th>
            <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Driver</th>
            <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Conf</th>
            <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;min-width:240px;">Rationale</th>
            <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Result</th>
          </tr>
        </thead>
        <tbody id="trade-body">
          ${buildTradeRows()}
        </tbody>
      </table>
    </div>
  </div>
</section>

<!-- ── AUTOPSY REPORT ─────────────────────────────────────────────────────────── -->
<section id="report" style="background:#08081a;padding:96px 28px;scroll-margin-top:80px;">
  <div style="max-width:1100px;margin:0 auto;">
    <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#38bdf8;margin-bottom:12px;font-weight:500;">Autopsy report</p>
    <h2 style="font-family:'Askan Light',Georgia,serif;font-size:clamp(1.6rem,3.5vw,2.6rem);line-height:1.1;letter-spacing:-0.01em;margin-bottom:8px;">The engine's verdict on whether<br>stated reasoning actually explains results.</h2>
    <p style="font-size:14px;color:rgba(255,255,255,0.45);margin-bottom:48px;line-height:1.6;max-width:560px;">${buildHeadline()}</p>

    <!-- KPI cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:64px;">
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
        <div style="font-family:'Askan Light',Georgia,serif;font-size:2.2rem;letter-spacing:-0.02em;color:#fff;">${report ? report.totalTrades : "—"}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:4px;">Trades analyzed</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
        <div style="font-family:'Askan Light',Georgia,serif;font-size:2.2rem;letter-spacing:-0.02em;color:#fff;">${report ? pct(report.overallWinRate) : "—"}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:4px;">Overall win rate</div>
      </div>
      <div title="% of stated reasons that were decorative or harmful — 0% is perfect honesty, 100% means nothing the agent said was true" style="background:${sdiCardBg};border:1px solid ${sdiCardBorder};border-radius:16px;padding:24px;cursor:default;">
        <div style="font-family:'Askan Light',Georgia,serif;font-size:2.2rem;letter-spacing:-0.02em;color:${sdiColor};">${report ? pct(report.selfDeceptionIndex) : "—"}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:4px;">Self-deception index <span style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;border:1px solid rgba(255,255,255,0.3);font-size:9px;font-weight:700;vertical-align:middle;margin-left:3px;color:rgba(255,255,255,0.4);">?</span></div>
      </div>
      <div title="Average gap between stated confidence and actual win rate — e.g. said 80% confident, won 51% of the time = 29pp gap" style="background:${ocgCardBg};border:1px solid ${ocgCardBorder};border-radius:16px;padding:24px;cursor:default;">
        <div style="font-family:'Askan Light',Georgia,serif;font-size:2.2rem;letter-spacing:-0.02em;color:${ocgColor};">${report ? pct(report.overconfidenceGap) : "—"}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:4px;">Overconfidence gap <span style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;border:1px solid rgba(255,255,255,0.3);font-size:9px;font-weight:700;vertical-align:middle;margin-left:3px;color:rgba(255,255,255,0.4);">?</span></div>
      </div>
    </div>

    <!-- Signal attribution -->
    <div style="margin-bottom:56px;">
      <h3 style="font-size:16px;font-weight:600;color:#fff;margin-bottom:6px;">What actually moved the PnL?</h3>
      <p style="font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:24px;line-height:1.55;">${attrLeadText}</p>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;">
        ${buildSignalRows()}
      </div>
    </div>

    <!-- Driver verdicts -->
    <div style="margin-bottom:56px;">
      <h3 style="font-size:16px;font-weight:600;color:#fff;margin-bottom:6px;">Were the stated reasons real?</h3>
      <p style="font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:24px;line-height:1.55;">For each reason the agent cited, we compare its win rate against a <strong style="color:rgba(255,255,255,0.7);">direction-adjusted baseline</strong> — what the same long/short mix of other trades won — so a label can't look like an edge just because it rode the market's direction. The L/S column shows that mix. Significance is a two-proportion z-test.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:rgba(52,211,153,0.8);"><span style="width:8px;height:8px;border-radius:50%;background:#34d399;flex-shrink:0;"></span>real edge — genuinely predicted wins</span>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:rgba(251,191,36,0.8);"><span style="width:8px;height:8px;border-radius:50%;background:#fbbf24;flex-shrink:0;"></span>decorative — cited often but made no difference</span>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:rgba(248,113,113,0.8);"><span style="width:8px;height:8px;border-radius:50%;background:#f87171;flex-shrink:0;"></span>harmful — trades where cited performed worse</span>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,0.35);"><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.2);flex-shrink:0;"></span>insufficient data</span>
      </div>
      <div style="overflow-x:auto;border-radius:14px;border:1px solid rgba(255,255,255,0.07);">
        <table style="min-width:700px;">
          <thead>
            <tr style="background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);">
              <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Stated reason</th>
              <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Times cited</th>
              <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">L / S</th>
              <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Win rate</th>
              <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Dir-adj baseline</th>
              <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Δ</th>
              <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Verdict</th>
            </tr>
          </thead>
          <tbody>${buildDriverRows()}</tbody>
        </table>
      </div>
      ${report?.effectiveSampleNote ? `<p style="font-size:11.5px;color:rgba(255,255,255,0.3);font-style:italic;margin-top:14px;line-height:1.55;border-top:1px dashed rgba(255,255,255,0.08);padding-top:12px;">${esc(report.effectiveSampleNote)}</p>` : ""}
    </div>

    <!-- Calibration -->
    <div>
      <h3 style="font-size:16px;font-weight:600;color:#fff;margin-bottom:6px;">Did confidence actually mean anything?</h3>
      <p style="font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:24px;line-height:1.55;">A well-calibrated agent should win ~80% of trades when it says it is 80% confident. A positive gap means it was overconfident — it said a higher number than it deserved.</p>
      <div style="overflow-x:auto;border-radius:14px;border:1px solid rgba(255,255,255,0.07);">
        <table style="min-width:520px;">
          <thead>
            <tr style="background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);">
              <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Confidence bucket</th>
              <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Trades</th>
              <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Agent said</th>
              <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Actually won</th>
              <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase;">Gap (overconfidence)</th>
            </tr>
          </thead>
          <tbody>${buildCalRows()}</tbody>
        </table>
      </div>
    </div>
  </div>
</section>

<!-- ── DOCUMENTATION ──────────────────────────────────────────────────────────── -->
<section id="docs" style="background:#06060f;padding:96px 28px;scroll-margin-top:80px;">
  <div style="max-width:1100px;margin:0 auto;">
    <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#38bdf8;margin-bottom:12px;font-weight:500;">Documentation</p>
    <h2 style="font-family:'Askan Light',Georgia,serif;font-size:clamp(1.6rem,3.5vw,2.6rem);line-height:1.1;letter-spacing:-0.01em;margin-bottom:40px;">Everything you need to install,<br>run, and extend Glass Box.</h2>

    <!-- Tab nav -->
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:32px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:6px;width:fit-content;">
      <button id="tab-install"  onclick="showDocTab('install')"  style="">Installation</button>
      <button id="tab-config"   onclick="showDocTab('config')"   style="">Configuration</button>
      <button id="tab-commands" onclick="showDocTab('commands')" style="">Commands</button>
      <button id="tab-schema"   onclick="showDocTab('schema')"   style="">Schema</button>
      <button id="tab-drivers"  onclick="showDocTab('drivers')"  style="">Driver tags</button>
    </div>

    <!-- Installation -->
    <div id="doc-install">
      <h3 style="font-size:18px;font-weight:600;margin-bottom:8px;">Getting started</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:20px;line-height:1.6;">Glass Box requires Node.js 20 or later. No other runtime dependencies.</p>
      <pre style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;font-family:'Courier New',monospace;font-size:13px;line-height:1.9;color:rgba(255,255,255,0.8);overflow-x:auto;white-space:pre;">git clone https://github.com/IamHarrie-Labs/glass-box
cd glass-box
npm install</pre>
    </div>

    <!-- Configuration -->
    <div id="doc-config" style="display:none;">
      <h3 style="font-size:18px;font-weight:600;margin-bottom:8px;">Configuration</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:20px;line-height:1.6;">Copy <code style="background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:4px;">.env.example</code> to <code style="background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:4px;">.env</code> and fill in your LLM key. Swap providers with no code change — just update the three <code style="background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:4px;">LLM_*</code> vars.</p>
      <pre style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;font-family:'Courier New',monospace;font-size:12px;line-height:1.9;color:rgba(255,255,255,0.75);overflow-x:auto;white-space:pre;"># Required to enable the LLM brain
LLM_API_KEY=your-key-here

# Any OpenAI-compatible endpoint works
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.1-8b-instant

# Tick interval in seconds (120 = 1 call / 2 min, safe for free tiers)
TICK_SECONDS=120

# Assets to trade, rotated one per tick. Multiple assets stop the
# "real driver" finding from being a single-coin tautology.
SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT

# Round-trip trading friction (fee + slippage) charged per closed
# position, in basis points. Keeps paper PnL honest. Default 6.
FRICTION_BPS=6</pre>
    </div>

    <!-- Commands -->
    <div id="doc-commands" style="display:none;animation:fadeUp 0.4s ease-out both;">
      <h3 style="font-size:18px;font-weight:600;margin-bottom:20px;">Commands</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${[
          ["npm run agent",   "Starts the live paper-trading agent. Ticks every TICK_SECONDS, fetches Bitget market data, asks the LLM to reason, logs a decision record. Runs continuously until stopped."],
          ["npm run autopsy", "Reads data/trades.jsonl, closes matured positions, runs the three autopsy analyses (attribution, self-deception, calibration), writes data/report.json."],
          ["npm run site",    "Builds this site (docs/index.html) with live data embedded from trades.jsonl and report.json. The push.ts module calls this automatically every hour."],
          ["npm run report",  "Reads data/report.json and generates data/report.html, a self-contained audit report. Open in any browser."],
          ["npm run demo",    "Seeds synthetic trades, runs autopsy, builds report. Fully offline — no keys or network needed. Good for a quick proof-of-concept."],
        ].map(([cmd, desc]) => `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px 24px;">
          <code style="font-size:14px;color:#38bdf8;">${cmd}</code>
          <p style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:8px;line-height:1.6;">${desc}</p>
        </div>`).join("")}
      </div>
    </div>

    <!-- Schema -->
    <div id="doc-schema" style="display:none;animation:fadeUp 0.4s ease-out both;">
      <h3 style="font-size:18px;font-weight:600;margin-bottom:8px;">Decision record schema</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:20px;line-height:1.6;">Every trade the agent opens is written to <code style="background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:4px;">data/trades.jsonl</code> as one JSON object per line. The thesis is written before the position opens — outcome fields are filled in after close.</p>
      <pre style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;font-family:'Courier New',monospace;font-size:12px;line-height:1.9;color:rgba(255,255,255,0.75);overflow-x:auto;white-space:pre;">{
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
  "outcome": {                // null until position closes
    "exitPrice": 63100.0,
    "pnlUsd": 10.47,
    "heldMinutes": 240
  }
}</pre>
      <p style="font-size:13px;color:rgba(255,255,255,0.45);margin-top:14px;line-height:1.6;">Any external agent that logs this schema can be autopsied by Glass Box without touching agent code.</p>
    </div>

    <!-- Drivers -->
    <div id="doc-drivers" style="display:none;animation:fadeUp 0.4s ease-out both;">
      <h3 style="font-size:18px;font-weight:600;margin-bottom:8px;">Driver tags</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:24px;line-height:1.6;">The LLM is constrained to map its reasoning onto this closed enum. Free-text reasons cannot be aggregated across trades — a closed enum can. This is what makes the self-deception analysis statistically valid.</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${[
          ["momentum_breakout", "#38bdf8", "Price breaking a level with volume/trend confirmation"],
          ["mean_reversion",    "#a78bfa", "Price has overshot and is due to revert"],
          ["trend_follow",      "#fbbf24", "Established trend continuation"],
          ["sentiment_extreme", "#f87171", "Fear and Greed or positioning at an extreme"],
          ["funding_signal",    "#34d399", "Funding rate imbalance suggesting crowded positioning"],
          ["breakdown_short",   "#fb923c", "Support break with downside momentum"],
          ["news_catalyst",     "rgba(255,255,255,0.55)", "Identifiable news or macro event driving price"],
        ].map(([tag, color, desc]) => `
        <div style="display:flex;gap:16px;align-items:flex-start;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px 20px;">
          <code style="font-family:'Courier New',monospace;font-size:12px;color:${color};flex-shrink:0;min-width:170px;">${tag}</code>
          <span style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5;">${desc}</span>
        </div>`).join("")}
      </div>
      <div style="margin-top:28px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px 24px;">
        <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;color:rgba(255,255,255,0.8);">Engine methodology</h4>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${[
            ["Signal attribution", "Pearson correlation of each objective market feature (RSI, 1h return, 24h return, funding rate, Fear &amp; Greed, volatility) with realized PnL. Answers: what actually predicted your winners, regardless of what you said?"],
            ["Self-deception detection", "For each driver, compares its win rate against a direction-adjusted baseline — what the same long/short mix of other trades won — so a label can't look like an edge just because it rode the market's direction. Significance is a two-proportion z-test. No real lift → decorative; significant negative lift → harmful; significant positive lift → real edge."],
            ["Confidence calibration", "Groups trades by stated confidence bucket and compares stated confidence against actual win rate. The Overconfidence Gap is the average spread between what the agent said and what happened."],
            ["Honesty caveat", "Trades on one asset open minutes apart and are held for hours, so their windows overlap and outcomes aren't fully independent. The report says so out loud and treats z-scores as directional, not hard p-values. PnL is also net of round-trip trading friction (FRICTION_BPS)."],
          ].map(([name, desc]) => `
          <div>
            <span style="font-size:13px;font-weight:500;color:rgba(255,255,255,0.75);">${name}</span>
            <p style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:4px;line-height:1.6;">${desc}</p>
          </div>`).join("")}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── FOOTER ─────────────────────────────────────────────────────────────────── -->
<footer style="background:#03030a;border-top:1px solid rgba(255,255,255,0.06);padding:40px 28px;">
  <div style="max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;">
    <div style="display:flex;align-items:center;gap:10px;">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <polygon points="10,2 18,6 10,10 2,6" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.6)" stroke-width="0.8" stroke-linejoin="round"/>
        <polygon points="2,6 10,10 10,18 2,14" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.6)" stroke-width="0.8" stroke-linejoin="round"/>
        <polygon points="10,10 18,6 18,14 10,18" fill="rgba(255,255,255,0.13)" stroke="rgba(255,255,255,0.6)" stroke-width="0.8" stroke-linejoin="round"/>
      </svg>
      <span style="font-family:'Askan Light',Georgia,serif;font-size:14px;color:rgba(255,255,255,0.6);letter-spacing:0.06em;">glassbox</span>
      <span style="font-size:11px;color:rgba(255,255,255,0.25);margin-left:8px;">open-source agent audit layer</span>
    </div>
    <div style="display:flex;align-items:center;gap:24px;">
      <span style="font-size:11px;color:rgba(255,255,255,0.25);">Bitget AI Hackathon S1</span>
      <a href="https://github.com/IamHarrie-Labs/glass-box" target="_blank" style="font-size:12px;color:rgba(255,255,255,0.4);">github.com/IamHarrie-Labs/glass-box</a>
    </div>
  </div>
</footer>

<script>
// ── Nav scroll background ──────────────────────────────────────────────────
const gbNav = document.getElementById('gb-nav');
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY > 60;
  gbNav.style.background = scrolled ? 'rgba(6,6,15,0.88)' : 'transparent';
  gbNav.style.backdropFilter = scrolled ? 'blur(20px)' : 'none';
  gbNav.style.webkitBackdropFilter = scrolled ? 'blur(20px)' : 'none';
  gbNav.style.borderBottomColor = scrolled ? 'rgba(255,255,255,0.06)' : 'transparent';
}, { passive: true });

// ── Mobile menu ────────────────────────────────────────────────────────────
let menuIsOpen = false;
function toggleMenu() {
  menuIsOpen = !menuIsOpen;
  document.getElementById('gb-mobile-menu').style.display = menuIsOpen ? 'flex' : 'none';
  document.getElementById('burger-open').style.display  = menuIsOpen ? 'none' : 'inline';
  document.getElementById('burger-close').style.display = menuIsOpen ? 'inline' : 'none';
}
function closeMenu() {
  menuIsOpen = false;
  document.getElementById('gb-mobile-menu').style.display = 'none';
  document.getElementById('burger-open').style.display  = 'inline';
  document.getElementById('burger-close').style.display = 'none';
}

// ── Responsive nav ─────────────────────────────────────────────────────────
function applyNavLayout() {
  const isMobile = window.innerWidth < 768;
  document.getElementById('desktop-nav').style.display = isMobile ? 'none' : 'flex';
  document.getElementById('gh-btn').style.display      = isMobile ? 'none' : 'inline-flex';
  document.getElementById('burger-btn').style.display  = isMobile ? 'flex' : 'none';
}
applyNavLayout();
window.addEventListener('resize', applyNavLayout);

// ── Section observer for active nav link ───────────────────────────────────
const NAV_ACTIVE   = 'color:#fff;background:rgba(255,255,255,0.1);padding:5px 12px;border-radius:8px;font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;';
const NAV_INACTIVE = 'color:rgba(255,255,255,0.58);background:transparent;padding:5px 12px;border-radius:8px;font-size:13px;font-weight:400;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;';
const navEls = { home: document.getElementById('nav-home'), logs: document.getElementById('nav-logs'), report: document.getElementById('nav-report'), docs: document.getElementById('nav-docs') };
const sectionToNav = { home:'home', howitworks:'home', logs:'logs', report:'report', docs:'docs' };

const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const navId = sectionToNav[e.target.id];
      Object.entries(navEls).forEach(([id, el]) => {
        if (el) {
          const badge = id === 'logs' ? ' <span style="font-size:10px;background:rgba(56,189,248,0.18);color:#38bdf8;padding:1px 6px;border-radius:4px;">${trades.length}</span>' : '';
          el.setAttribute('style', id === navId ? NAV_ACTIVE : NAV_INACTIVE);
        }
      });
    }
  });
}, { threshold: 0.25 });
['home','howitworks','logs','report','docs'].forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });

// ── Trade chip filters ─────────────────────────────────────────────────────
let activeDriver = 'all', activeSide = 'both';

const CHIP_ON  = 'background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.35);color:#38bdf8;padding:6px 13px;border-radius:100px;font-size:12px;font-family:Inter,sans-serif;cursor:pointer;font-weight:500;';
const CHIP_OFF = 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.58);padding:6px 13px;border-radius:100px;font-size:12px;font-family:Inter,sans-serif;cursor:pointer;font-weight:400;';

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
  document.getElementById('trade-count').textContent = count;

  document.querySelectorAll('[data-chip-driver]').forEach(btn => {
    btn.setAttribute('style', btn.dataset.chipDriver === activeDriver ? CHIP_ON : CHIP_OFF);
  });
  document.querySelectorAll('[data-chip-side]').forEach(btn => {
    btn.setAttribute('style', btn.dataset.chipSide === activeSide ? CHIP_ON : CHIP_OFF);
  });
}
applyFilters(); // initialize chip styles

// ── Docs tabs ──────────────────────────────────────────────────────────────
const TAB_ON  = 'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.14);color:#fff;padding:7px 16px;border-radius:8px;font-size:13px;font-family:Inter,sans-serif;cursor:pointer;font-weight:500;';
const TAB_OFF = 'background:transparent;border:1px solid transparent;color:rgba(255,255,255,0.45);padding:7px 16px;border-radius:8px;font-size:13px;font-family:Inter,sans-serif;cursor:pointer;font-weight:400;';

function showDocTab(tab) {
  ['install','config','commands','schema','drivers'].forEach(t => {
    const panel = document.getElementById('doc-' + t);
    const btn   = document.getElementById('tab-' + t);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
    if (btn)   btn.setAttribute('style', t === tab ? TAB_ON : TAB_OFF);
  });
}
showDocTab('install');
</script>
</body>
</html>`;

mkdirSync("docs", { recursive: true });
writeFileSync("docs/index.html", HTML, "utf8");
console.log(`Wrote docs/index.html (${trades.length} trades, report: ${report ? "yes" : "no data yet"})`);
console.log("Open docs/index.html in a browser or push to deploy.");
