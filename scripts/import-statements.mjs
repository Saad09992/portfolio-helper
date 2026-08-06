#!/usr/bin/env node
// Build a ledger import bundle from broker statement PDFs.
//
//   node scripts/import-statements.mjs statements/ -o bundle.json
//
// Emits `{ version, transactions }` — the shape the app's Import backup button
// accepts. Importing REPLACES the whole ledger, so the bundle is the complete
// trade history, not a delta. Nothing is written to D1: the browser owns that
// (see `loadTransactions` in src/portfolio/storage.ts), and a direct D1 write
// gets clobbered on the next save.
//
// Three formats are recognised, by content rather than filename:
//
//   IWT "Transaction Statement"  gross rate + exact net amount, grouped by
//                                security — but carries NO trade dates.
//   IWT "Statement Of Account"   trade dates (the `Chq. Dt` column) and net
//                                amounts, but only net rates. Consolidates
//                                same-day fills into one row.
//   Finqalab "Periodic Trade     dates + gross rate + commission. No net
//   Details Report"              amounts and no statutory charges, so its
//                                fees are commission + CVT only.
//
// The two IWT reports are therefore joined: quantities from the statement are
// packed into each ledger row to inherit its date. Every trade carries an
// explicit `feeOverride`, so imported rows never depend on the fee-config rates
// — which matters because two brokers with different rate cards cannot both be
// derived from the app's single global config.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const SCHEMA_VERSION = 2;

// ---------------------------------------------------------------- utilities

const money = (s) => Math.round(parseFloat(String(s).replace(/,/g, "")) * 100);
const rupees = (paisa) => (paisa / 100).toFixed(2);

/** dd-mm-yy → ISO. The statements are all 21st century. */
function isoFromShort(s) {
  const [d, m, y] = s.split("-");
  return `20${y}-${m}-${d}`;
}

/**
 * Stable synthetic id. Re-running the importer on the same statements must
 * produce the same ids, so a re-import doesn't duplicate or churn rows.
 *
 * The trade's own identity must be part of `parts`. Date, ticker, side, size
 * and price are NOT unique between them: one order filled in several lots
 * reports the same numbers on every line, and two such rows would collide into
 * a single id and violate the primary key on insert.
 */
function idFor(parts) {
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

function pdfText(path) {
  return execFileSync("pdftotext", ["-layout", path, "-"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

// ------------------------------------------------------- security reference

/** ticker → { name, sector }, read from the scraped PSX list when present. */
function loadSecurities(dbPath) {
  const out = new Map();
  try {
    const rows = execFileSync(
      "sqlite3",
      [dbPath, "select s.ticker, s.name, coalesce(c.name,'') from stocks s left join sectors c on c.code = s.sector;"],
      { encoding: "utf8" },
    );
    for (const line of rows.split("\n")) {
      const [ticker, name, sector] = line.split("|");
      if (ticker) out.set(ticker.toUpperCase(), { name: name ?? "", sector: sector ?? "" });
    }
  } catch {
    // Reference data is a nicety — the ledger only needs the ticker.
  }
  return out;
}

// --------------------------------------------- IWT: transaction statement

/**
 * Rows look like:
 *   T+1REG B BUY  500  46.91  0.0704  5  5  0  0  1  0  1  23,502.37
 * The middle columns lose their decimals in extraction, so only the first
 * three numbers (quantity, gross rate, commission rate) and the last one
 * (the signed net amount) are trusted. Fees are derived from those two ends,
 * which is exact — the components are only ever used for display.
 */
function parseIwtStatement(text) {
  const trades = [];
  let symbol = null;

  for (const line of text.split("\n")) {
    const head = line.match(/^\S.*?\s{2,}([A-Z0-9]+)\s*$/);
    if (head && !line.includes("T+1REG") && !/^(Page|Date|Time|User)/.test(line)) {
      symbol = head[1];
    }
    const m = line.match(/^\s*T\+1\w*\s+([BPD])\s+(BUY|SELL)\s+(.*)$/);
    if (!m || !symbol) continue;

    const [, flag, side, rest] = m;
    const nums = rest.match(/-?[\d,]+\.?\d*/g) ?? [];
    if (nums.length < 4) continue;

    const shares = Math.round(parseFloat(nums[0].replace(/,/g, "")));
    const price = money(nums[1]);
    const net = Math.abs(money(nums[nums.length - 1]));
    const gross = shares * price;
    // A buy settles for more than gross, a sell for less; either way the
    // difference is what the broker took.
    const fees = side === "BUY" ? net - gross : gross - net;

    // Position in the statement is this row's only distinguishing mark — the
    // report carries no trade number, and repeated fills are otherwise equal.
    trades.push({ symbol, flag, side, shares, price, net, fees, uid: `row${trades.length}` });
  }
  return trades;
}

// ------------------------------------------------- IWT: statement of account

/**
 * Trade rows carry the settlement date in column 2 and the real trade date in
 * the trailing `Chq. Dt` column. Narrations wrap, so rows are re-joined on the
 * leading entry id (e.g. `CV040088`) before being read.
 */
function parseIwtLedger(text) {
  const joined = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (/^[A-Z]{2}\d{6}\s/.test(line)) {
      if (current) joined.push(current);
      current = line.trimEnd();
    } else if (current && line.trim() && !/^(Page|Date|Time|Entry)/.test(line)) {
      current += " " + line.trim();
    }
  }
  if (current) joined.push(current);

  // A trade done on the ledger's last day settles after it, so it has no row
  // here. The period end is the best available date for those.
  const period = text.match(/To\s*Date\s*:\s*(\d{2}-\d{2}-\d{4})/);
  const periodEnd = period ? `${period[1].slice(6)}-${period[1].slice(3, 5)}-${period[1].slice(0, 2)}` : null;

  const rows = [];
  for (const entry of joined) {
    const m = entry.match(/^(\S+)\s+(\d{2}-\d{2}-\d{2})\s+(.*)$/);
    if (!m) continue;
    const [, , settled, rest] = m;
    // "@ -\n126.06" rejoins as "@ - 126.06", so the sign may be detached.
    const trade = rest.match(
      /T\+1\s+(Buy|Sell|Diff\.?)\s*#?\s*(\d+)\s+([A-Z0-9]+)\s+(\d+)\s*@\s*-?\s*[\d.]+/i,
    );
    if (!trade) continue;
    const dated = rest.match(/(\d{2}-\d{2}-\d{2})\s*(?:[A-Z]+)?\s*$/);
    rows.push({
      kind: trade[1].replace(/\.$/, "").toUpperCase(),
      symbol: trade[3],
      shares: Number(trade[4]),
      date: isoFromShort(dated ? dated[1] : settled),
    });
  }
  return { rows, periodEnd };
}

/**
 * Give every statement trade a date.
 *
 * One ledger row is one settlement of one security and side, and may cover
 * several statement fills — so for each row we find the subset of that
 * security's unclaimed fills whose quantities sum to it. A `Diff.` row is an
 * intraday square-up reported as a single net figure; both its legs are the
 * `D`-flagged fills for that security.
 */
function dateIwtTrades(statement, ledger, { onWarn }) {
  const pool = new Map();
  for (const t of statement) {
    if (!pool.has(t.symbol)) pool.set(t.symbol, []);
    pool.get(t.symbol).push(t);
  }

  const dated = [];
  for (const row of [...ledger].sort((a, b) => a.date.localeCompare(b.date))) {
    const candidates = pool.get(row.symbol) ?? [];

    if (row.kind === "DIFF") {
      const legs = candidates.filter((c) => c.flag === "D");
      for (const leg of legs) candidates.splice(candidates.indexOf(leg), 1);
      dated.push(...legs.map((c) => ({ ...c, date: row.date })));
      continue;
    }

    const side = row.kind === "BUY" ? "BUY" : "SELL";
    const same = candidates.filter((c) => c.side === side);
    const combo = subsetSummingTo(same, row.shares);
    if (!combo) {
      onWarn(`no statement fills sum to ledger row ${row.symbol} ${side} ${row.shares} on ${row.date}`);
      continue;
    }
    for (const c of combo) candidates.splice(candidates.indexOf(c), 1);
    dated.push(...combo.map((c) => ({ ...c, date: row.date })));
  }

  const orphans = [...pool.values()].flat();
  return { dated, orphans };
}

/** Smallest subset of `items` whose shares total `target`, or null. */
function subsetSummingTo(items, target) {
  for (let size = 1; size <= items.length; size++) {
    const found = combinations(items, size).find(
      (combo) => combo.reduce((sum, c) => sum + c.shares, 0) === target,
    );
    if (found) return found;
  }
  return null;
}

function combinations(items, size) {
  if (size === 0) return [[]];
  const out = [];
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), size - 1)) out.push([item, ...rest]);
  });
  return out;
}

// ------------------------------------------------------------- Finqalab

/**
 * Rows look like:
 *   AICL  9758836   2025-10-13  2025-10-15  BUY  86.99  110  9568.9  0.217475  23.9223  0
 * i.e. symbol, trade no, trade date, settlement, side, gross rate, quantity,
 * gross total, per-share commission, commission, CVT.
 *
 * The report lists no net amount and no statutory charges, so `fees` here is
 * commission + CVT and is a FLOOR on what was actually deducted.
 */
function parseFinqalab(text) {
  const trades = [];
  for (const line of text.split("\n")) {
    const m = line.match(
      /^\s*([A-Z0-9]+)\s+(\d{6,})\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(BUY|SELL)\s+([\d.]+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/,
    );
    if (!m) continue;
    trades.push({
      symbol: m[1],
      date: m[3],
      side: m[5],
      price: money(m[6]),
      shares: Number(m[7]),
      fees: money(m[10]) + money(m[11]),
      uid: m[2], // the broker's own trade number
    });
  }
  return trades;
}

// ------------------------------------------------------------- assembly

/**
 * Order trades so a position never goes negative mid-day.
 *
 * Intraday square-ups are sometimes reported sell-leg first, which the replay
 * rejects as a sale beyond the shares held. Within one day and ticker the fills
 * are simultaneous, so putting buys first is faithful and keeps the replay
 * legal; across days the real order is preserved.
 */
function orderForReplay(transactions) {
  const rank = (t) => (t.type === "BUY" ? 0 : 1);
  return [...transactions].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.ticker.localeCompare(b.ticker) ||
      rank(a) - rank(b),
  );
}

function toTransaction(source, broker, securities) {
  const meta = securities.get(source.symbol.toUpperCase()) ?? { name: "", sector: "" };
  return {
    id: idFor([broker, source.uid, source.date, source.symbol, source.side, source.shares, source.price]),
    date: source.date,
    type: source.side,
    ticker: source.symbol.toUpperCase(),
    name: meta.name,
    sector: meta.sector,
    shares: source.shares,
    price: source.price,
    amount: 0,
    feeOverride: { total: Math.max(0, source.fees) },
    note: broker,
  };
}

// ------------------------------------------------------------------ main

function main(argv) {
  const args = argv.slice(2);
  const outIdx = args.findIndex((a) => a === "-o" || a === "--out");
  const out = outIdx >= 0 ? args[outIdx + 1] : "statement-bundle.json";
  const cashIdx = args.findIndex((a) => a === "--cash");
  const cashTarget = cashIdx >= 0 ? money(args[cashIdx + 1]) : null;
  const capIdx = args.findIndex((a) => a === "--capital");
  const capital = capIdx >= 0 ? money(args[capIdx + 1]) : null;
  const cfgIdx = args.findIndex((a) => a === "--config");
  const lossIdx = args.findIndex((a) => a === "--opening-loss");
  const invIdx = args.findIndex((a) => a === "--investments");
  const consumed = new Set([
    outIdx + 1, cashIdx + 1, cfgIdx + 1, lossIdx + 1, capIdx + 1, invIdx + 1,
  ]);
  const dir = args.find((a, i) => !a.startsWith("-") && !consumed.has(i)) ?? "statements";

  const securities = loadSecurities("data/psx-stocks.db");
  const warnings = [];
  const onWarn = (message) => warnings.push(message);

  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf"));
  let iwtStatement = [];
  let iwtLedger = [];
  let ledgerEnd = null;
  let finqalab = [];

  for (const file of files) {
    const text = pdfText(join(dir, file));
    if (text.includes("With Tax & Commission")) {
      iwtStatement = iwtStatement.concat(parseIwtStatement(text));
      console.log(`  ${file}: IWT transaction statement`);
    } else if (text.includes("Statement Of Account")) {
      const parsed = parseIwtLedger(text);
      iwtLedger = iwtLedger.concat(parsed.rows);
      if (parsed.periodEnd && (!ledgerEnd || parsed.periodEnd > ledgerEnd)) {
        ledgerEnd = parsed.periodEnd;
      }
      console.log(`  ${file}: IWT statement of account`);
    } else if (text.includes("Periodic Trade Details Report")) {
      finqalab = finqalab.concat(parseFinqalab(text));
      console.log(`  ${file}: Finqalab periodic trade details`);
    } else {
      onWarn(`unrecognised statement format, skipped: ${file}`);
    }
  }

  const transactions = [];

  if (iwtStatement.length) {
    if (!iwtLedger.length) {
      onWarn("IWT transaction statement found with no statement of account — it carries no trade dates, so none of its trades can be imported");
    } else {
      const { dated, orphans } = dateIwtTrades(iwtStatement, iwtLedger, { onWarn });
      transactions.push(...dated.map((t) => toTransaction(t, "IWT", securities)));
      // Dropping an orphan would silently lose a real trade, so it is dated to
      // the ledger's last day — where an unsettled trade must have happened —
      // and the guess is recorded on the row itself.
      for (const o of orphans) {
        if (!ledgerEnd) {
          onWarn(`IWT ${o.symbol} ${o.side} ${o.shares} has no ledger row and no period end to fall back on — skipped`);
          continue;
        }
        transactions.push(
          toTransaction({ ...o, date: ledgerEnd }, "IWT (date inferred)", securities),
        );
        onWarn(
          `IWT ${o.symbol} ${o.side} ${o.shares} @ ${rupees(o.price)} settles after the ledger ends; ` +
            `dated ${ledgerEnd} from the statement period. Verify against the contract note.`,
        );
      }
      console.log(`  IWT: ${dated.length} dated, ${orphans.length} inferred`);
    }
  }

  if (finqalab.length) {
    transactions.push(...finqalab.map((t) => toTransaction(t, "Finqalab", securities)));
    console.log(`  Finqalab: ${finqalab.length} trades`);
  }

  const ordered = orderForReplay(transactions);

  // Statements list trades, not funding. Without the deposits and withdrawals
  // that actually moved money, replayed cash is meaningless — so one opening
  // deposit is derived to land the balance on the figure the broker reports as
  // tradeable today. It is a plug, and says so on the row.
  if (cashTarget != null) {
    const swing = ordered.reduce((sum, t) => {
      const gross = t.shares * t.price;
      const fees = t.feeOverride?.total ?? 0;
      return sum + (t.type === "BUY" ? -(gross + fees) : gross - fees);
    }, 0);
    const firstDate = ordered[0]?.date ?? new Date().toISOString().slice(0, 10);

    // With `--capital` the deposit is the real figure and the leftover is a
    // cost: charges the statements never itemised. Booking that as an EXPENSE
    // rather than folding it into the deposit keeps the capital base honest —
    // a smaller deposit would flatter every return measured against it.
    const opening = capital ?? cashTarget - swing;
    const shortfall = capital != null ? capital + swing - cashTarget : 0;

    ordered.unshift({
      id: idFor(["opening", String(opening)]),
      date: firstDate,
      type: opening >= 0 ? "DEPOSIT" : "WITHDRAW",
      ticker: "", name: "", sector: "",
      shares: 0, price: 0, amount: Math.abs(opening),
      note:
        capital != null
          ? "opening capital"
          : "opening capital — balances the ledger to the broker's tradeable cash",
    });

    if (shortfall > 0) {
      ordered.push({
        id: idFor(["charges", String(shortfall)]),
        date: ordered[ordered.length - 1]?.date ?? firstDate,
        type: "EXPENSE",
        ticker: "", name: "", sector: "",
        shares: 0, price: 0, amount: shortfall,
        // Whatever the trades and the known capital cannot account for. Usually
        // charges no statement itemised, but it also absorbs any cash the broker
        // holds back from trading — which is not a cost, so a large figure here
        // is worth splitting before reading it as fee drag.
        note: "unreconciled — unitemised charges and any broker-held cash",
      });
    } else if (shortfall < 0) {
      onWarn(
        `capital ${rupees(capital)} leaves ${rupees(-shortfall)} MORE cash than the target — ` +
          `a deposit is missing from the Invest tab, or the cash target is too low. No charge booked.`,
      );
    }
    console.log(
      `  cash: trades swing ${rupees(swing)}, opening ${rupees(opening)}` +
        (shortfall > 0 ? `, charges ${rupees(shortfall)}` : "") +
        ` -> ${rupees(cashTarget)}`,
    );
  }

  // Carrying the fee config in the bundle makes the import atomic. It matters
  // for `openingLosses`: a seeded prior-year loss covers history the ledger
  // could not see, so once the import supplies that history the seed has to
  // shrink by whatever the ledger now computes for itself, or the loss is
  // counted twice. Applying config and trades in one step removes the window
  // where only one of them has landed.
  let feeConfig = null;
  if (cfgIdx >= 0) {
    feeConfig = JSON.parse(readFileSync(args[cfgIdx + 1], "utf8"));
    if (lossIdx >= 0) {
      const [fy, amount] = args[lossIdx + 1].split(":");
      feeConfig.openingLosses = amount && money(amount) > 0 ? [{ fy, amount: money(amount) }] : [];
      console.log(`  feeConfig: openingLosses -> ${fy} ${amount}`);
    }
  } else if (lossIdx >= 0) {
    onWarn("--opening-loss needs --config: a partial fee config would reset every other rate to its default");
  }

  // `id` is the primary key, so a collision is rejected by the database and the
  // whole save is rolled back — after the import has already been applied in
  // the browser. Catch it here, where the message can name the rows.
  const seen = new Map();
  const collisions = [];
  for (const t of ordered) {
    if (seen.has(t.id)) collisions.push([seen.get(t.id), t]);
    else seen.set(t.id, t);
  }
  if (collisions.length) {
    console.error(`\nABORT: ${collisions.length} duplicate transaction id(s) — nothing written.`);
    for (const [a, b] of collisions.slice(0, 5)) {
      console.error(`  ${a.date} ${a.ticker} ${a.type} ${a.shares} @ ${rupees(a.price)}`);
      console.error(`  ${b.date} ${b.ticker} ${b.type} ${b.shares} @ ${rupees(b.price)}  <- same id ${b.id}`);
    }
    process.exit(1);
  }

  const bundle = { version: SCHEMA_VERSION, transactions: ordered };
  if (feeConfig) bundle.feeConfig = feeConfig;

  // Contributions come from the Invest tab, so a correction there has to travel
  // with the trades or the two disagree about how much capital exists. Fields
  // the bundle omits are left alone on import — holdings and daily snapshots in
  // particular survive untouched.
  if (invIdx >= 0) {
    const entries = JSON.parse(readFileSync(args[invIdx + 1], "utf8"));
    bundle.investments = entries;
    const total = entries.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    console.log(`  investments: ${entries.length} entries, ${rupees(total)} contributed`);
    if (capital != null && total !== capital) {
      onWarn(
        `--capital ${rupees(capital)} disagrees with the Invest tab total ${rupees(total)}; ` +
          `the app derives contributions from the Invest tab, so it will use ${rupees(total)}.`,
      );
    }
  }

  writeFileSync(out, JSON.stringify(bundle, null, 2));

  console.log(`\n${ordered.length} transactions -> ${out}`);
  if (ordered.length) {
    console.log(`range ${ordered[0].date} .. ${ordered[ordered.length - 1].date}`);
  }
  for (const w of warnings) console.log(`WARN  ${w}`);
  return warnings.length ? 0 : 0;
}

main(process.argv);
