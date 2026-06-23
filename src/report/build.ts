/**
 * `npm run report` — turn data/report.json into a single self-contained HTML
 * page (no external assets) that judges can open in a browser. This is the
 * "demo dopamine" half: the autopsy made visual.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { AutopsyReport } from "../engine/autopsy.ts";

if (!existsSync("data/report.json")) {
  console.error("No data/report.json. Run `npm run autopsy` first.");
  process.exit(1);
}
const r = JSON.parse(readFileSync("data/report.json", "utf8")) as AutopsyReport;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const verdictColor: Record<string, string> = {
  real_edge: "#16a34a",
  decorative: "#d97706",
  harmful: "#dc2626",
  insufficient_data: "#64748b",
};

const attrRows = r.attribution
  .map((a) => {
    const w = Math.abs(a.correlationWithPnl) * 100;
    const col = a.correlationWithPnl >= 0 ? "#22d3ee" : "#f87171";
    return `<tr><td>${a.feature}</td><td class="num">${a.correlationWithPnl.toFixed(2)}</td>
      <td class="bar"><span style="width:${w}%;background:${col}"></span></td></tr>`;
  })
  .join("");

const driverRows = r.drivers
  .map(
    (d) => `<tr>
      <td>${d.driver}</td>
      <td class="num">${d.timesCited}</td>
      <td class="num">${pct(d.winRateWhenCited)}</td>
      <td class="num">${pct(d.baselineWinRate)}</td>
      <td class="num">${(d.edge * 100).toFixed(1)}pp</td>
      <td><span class="pill" style="background:${verdictColor[d.verdict]}">${d.verdict.replace("_", " ")}</span></td>
    </tr>`
  )
  .join("");

const calRows = r.calibration
  .map((c) => {
    const over = c.gap > 0.1;
    return `<tr>
      <td>${c.label}</td><td class="num">${c.trades}</td>
      <td class="num">${pct(c.avgConfidence)}</td>
      <td class="num">${pct(c.actualWinRate)}</td>
      <td class="num" style="color:${over ? "#f87171" : "#94a3b8"}">${(c.gap * 100).toFixed(1)}pp${over ? " ⚠" : ""}</td>
    </tr>`;
  })
  .join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Glass Box · Agent Autopsy</title>
<style>
  :root{--bg:#0b1020;--card:#121a30;--line:#22304f;--ink:#e6ecff;--mut:#8aa0c8;}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);
    font:15px/1.5 ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif;padding:32px}
  .wrap{max-width:860px;margin:0 auto}
  h1{font-size:22px;margin:0 0 2px} .sub{color:var(--mut);margin:0 0 24px}
  .verdict{background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid var(--line);
    border-left:4px solid #d97706;border-radius:12px;padding:18px 20px;margin-bottom:24px;font-size:16px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
  .kpi .v{font-size:24px;font-weight:700} .kpi .l{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:20px}
  h2{font-size:15px;margin:0 0 4px} .hint{color:var(--mut);font-size:13px;margin:0 0 14px}
  table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);font-size:14px}
  th{color:var(--mut);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  td.bar{width:42%} td.bar span{display:block;height:10px;border-radius:5px}
  .pill{color:#fff;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;text-transform:capitalize}
  footer{color:var(--mut);font-size:12px;text-align:center;margin-top:24px}
</style></head><body><div class="wrap">
  <h1>Glass Box · Agent Autopsy</h1>
  <p class="sub">Measuring the gap between what the agent <em>said</em> and what actually drove its PnL.</p>

  <div class="verdict"><strong>Verdict.</strong> ${r.headline}</div>

  <div class="grid">
    <div class="kpi"><div class="v">${r.totalTrades}</div><div class="l">Trades</div></div>
    <div class="kpi"><div class="v">${pct(r.overallWinRate)}</div><div class="l">Win rate</div></div>
    <div class="kpi"><div class="v">${pct(r.selfDeceptionIndex)}</div><div class="l">Self-deception</div></div>
    <div class="kpi"><div class="v">${pct(r.overconfidenceGap)}</div><div class="l">Overconfidence</div></div>
  </div>

  <div class="card">
    <h2>Job 1 · What actually drove PnL</h2>
    <p class="hint">Correlation of each objective market feature with realized PnL (signed by trade side).</p>
    <table><thead><tr><th>Feature</th><th class="num">Corr</th><th>Strength</th></tr></thead><tbody>${attrRows}</tbody></table>
  </div>

  <div class="card">
    <h2>Job 2 · Are the stated reasons real?</h2>
    <p class="hint">For each reason the agent cited: did citing it beat its baseline? "Decorative" = a story, not an edge.</p>
    <table><thead><tr><th>Stated driver</th><th class="num">Cited</th><th class="num">Win</th><th class="num">Base</th><th class="num">Edge</th><th>Verdict</th></tr></thead><tbody>${driverRows}</tbody></table>
  </div>

  <div class="card">
    <h2>Job 3 · Confidence calibration</h2>
    <p class="hint">When the agent was confident, did it actually win more? Gap = stated confidence − real win rate.</p>
    <table><thead><tr><th>Confidence</th><th class="num">Trades</th><th class="num">Said</th><th class="num">Won</th><th class="num">Gap</th></tr></thead><tbody>${calRows}</tbody></table>
  </div>

  <footer>Generated by Glass Box · open-source agent audit layer · Bitget AI Hackathon S1</footer>
</div></body></html>`;

writeFileSync("data/report.html", html, "utf8");
console.log("Wrote data/report.html — open it in a browser.");
