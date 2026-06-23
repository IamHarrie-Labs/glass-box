/**
 * `npm run autopsy` — load the trade log, run the autopsy, print a readable
 * summary to the terminal, and persist the structured report for the HTML
 * report builder.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { loadRecords } from "../store.ts";
import { runAutopsy } from "./autopsy.ts";

const records = loadRecords();
if (records.length === 0) {
  console.error("No trades found in data/trades.jsonl. Run `npm run demo` or the agent first.");
  process.exit(1);
}

const report = runAutopsy(records);

if (!existsSync("data")) mkdirSync("data");
writeFileSync("data/report.json", JSON.stringify(report, null, 2), "utf8");

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

console.log("\n===== GLASS BOX · AUTOPSY =====\n");
console.log(`Trades analyzed : ${report.totalTrades}`);
console.log(`Overall win rate: ${pct(report.overallWinRate)}`);
console.log(`Total PnL       : $${report.totalPnlUsd.toFixed(2)}`);

console.log("\n-- Job 1 · What actually drove PnL --");
for (const a of report.attribution) {
  const bar = "#".repeat(Math.round(Math.abs(a.correlationWithPnl) * 20));
  console.log(`  ${a.feature.padEnd(14)} corr ${a.correlationWithPnl.toFixed(2).padStart(6)}  ${bar}`);
}

console.log("\n-- Job 2 · Are the stated reasons real? --");
for (const d of report.drivers) {
  console.log(
    `  ${d.driver.padEnd(18)} cited ${String(d.timesCited).padStart(3)}x  ` +
    `win ${pct(d.winRateWhenCited)} vs base ${pct(d.baselineWinRate)}  ` +
    `=> ${d.verdict.toUpperCase()}`
  );
}
console.log(`  Self-Deception Index: ${pct(report.selfDeceptionIndex)} of citations are decorative/harmful`);

console.log("\n-- Job 3 · Confidence calibration --");
for (const c of report.calibration) {
  const flag = c.gap > 0.1 ? "  <- overconfident" : "";
  console.log(
    `  conf ${c.label.padEnd(9)} (${String(c.trades).padStart(3)} trades)  ` +
    `said ${pct(c.avgConfidence)}  actually won ${pct(c.actualWinRate)}${flag}`
  );
}
console.log(`  Overconfidence gap: ${pct(report.overconfidenceGap)}`);

console.log("\n-- VERDICT --");
console.log(`  ${report.headline}\n`);
console.log("Wrote data/report.json. Next: npm run report\n");
