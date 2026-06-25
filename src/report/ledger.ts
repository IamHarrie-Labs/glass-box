/**
 * Ledger generator. Derives a human-readable balance ledger from the trade log.
 *
 * The submission form asks for a record with "timestamp, pair, side, price,
 * size, balance changes". trades.jsonl carries everything except a running
 * balance (it only stores per-trade pnlUsd). This walks every CLOSED trade in
 * close-time order, accumulates a running account balance from a fixed starting
 * stake, and writes data/ledger.csv — one row per close, with the balance
 * before and after each trade so the balance changes are explicit and auditable.
 *
 * It is purely derived from trades.jsonl, so it never disturbs the live agent.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { loadRecords } from "../store.ts";

// Starting paper-account balance, in USD. Override with START_BALANCE.
const START_BALANCE = Number(process.env.START_BALANCE ?? 10000);

type Row = {
  closeTime: number;
  tradeId: string;
  pair: string;
  side: string;
  driver: string;
  entryPrice: number;
  exitPrice: number;
  sizeUsd: number;
  pnlUsd: number;
};

const records = loadRecords();

// Only closed trades have a realized outcome. Close time = open time + hold.
const rows: Row[] = records
  .filter((r) => r.outcome !== null)
  .map((r) => {
    const o = r.outcome!;
    const closeTime = Date.parse(r.timestamp) + o.heldMinutes * 60_000;
    return {
      closeTime,
      tradeId: r.tradeId,
      pair: r.pair,
      side: r.side,
      driver: r.statedThesis.primaryDriver,
      entryPrice: r.entryPrice,
      exitPrice: o.exitPrice,
      sizeUsd: r.sizeUsd,
      pnlUsd: o.pnlUsd,
    };
  })
  .sort((a, b) => a.closeTime - b.closeTime);

const header = [
  "close_timestamp",
  "trade_id",
  "pair",
  "side",
  "primary_driver",
  "entry_price",
  "exit_price",
  "size_usd",
  "pnl_usd",
  "balance_before_usd",
  "balance_after_usd",
].join(",");

let balance = START_BALANCE;
const lines = [header];
for (const row of rows) {
  const before = balance;
  balance = Number((balance + row.pnlUsd).toFixed(2));
  lines.push(
    [
      new Date(row.closeTime).toISOString(),
      row.tradeId,
      row.pair,
      row.side,
      row.driver,
      row.entryPrice.toFixed(2),
      row.exitPrice.toFixed(2),
      row.sizeUsd.toFixed(2),
      row.pnlUsd.toFixed(2),
      before.toFixed(2),
      balance.toFixed(2),
    ].join(",")
  );
}

mkdirSync("data", { recursive: true });
writeFileSync("data/ledger.csv", lines.join("\n") + "\n", "utf8");

const net = Number((balance - START_BALANCE).toFixed(2));
console.log(
  `Wrote data/ledger.csv — ${rows.length} closed trades, ` +
    `start $${START_BALANCE.toFixed(2)} -> end $${balance.toFixed(2)} (net ${net >= 0 ? "+" : ""}${net})`
);
