import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/psx-stocks.db");
const PSX_URL = "https://dps.psx.com.pk/market-watch";

const SECTORS = {
  "0801": "Automobile Assembler",
  "0802": "Automobile Parts & Accessories",
  "0803": "Cable & Electrical Goods",
  "0804": "Cement",
  "0805": "Chemical",
  "0806": "Close-End Mutual Fund",
  "0807": "Commercial Banks",
  "0808": "Engineering",
  "0809": "Fertilizer",
  "0810": "Food & Personal Care Products",
  "0811": "Glass & Ceramics",
  "0812": "Insurance",
  "0813": "Inv. Banks / Inv. Cos. / Securities Cos.",
  "0814": "Jute",
  "0815": "Leasing Companies",
  "0816": "Leather & Tanneries",
  "0818": "Miscellaneous",
  "0819": "Modaraba",
  "0820": "Oil & Gas Exploration Companies",
  "0821": "Oil & Gas Marketing Companies",
  "0822": "Paper, Board & Packaging",
  "0823": "Pharmaceuticals",
  "0824": "Power Generation & Distribution",
  "0825": "Refinery",
  "0826": "Sugar & Allied Industries",
  "0827": "Synthetic & Rayon",
  "0828": "Technology & Communication",
  "0829": "Textile Composite",
  "0830": "Textile Spinning",
  "0831": "Textile Weaving",
  "0832": "Tobacco",
  "0833": "Transport",
  "0834": "Vanaspati & Allied Industries",
  "0835": "Woollen",
  "0836": "Real Estate Investment Trust",
  "0837": "Property",
  "0838": "Exchange Traded Funds",
};

async function main() {
  console.log("Fetching PSX market watch...");

  const res = await fetch(PSX_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    console.error(`PSX returned ${res.status}`);
    process.exit(1);
  }

  const html = await res.text();
  console.log(`Received ${html.length} bytes`);

  const stocks = parseStocks(html);
  console.log(`Parsed ${stocks.length} stocks`);

  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sectors (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS stocks (
      ticker TEXT PRIMARY KEY,
      name   TEXT NOT NULL,
      sector TEXT NOT NULL,
      FOREIGN KEY (sector) REFERENCES sectors(code)
    )
  `);

  db.exec("DELETE FROM stocks");
  db.exec("DELETE FROM sectors");

  const insertSector = db.prepare(
    "INSERT OR REPLACE INTO sectors (code, name) VALUES (?, ?)",
  );
  for (const [code, name] of Object.entries(SECTORS)) {
    insertSector.run(code, name);
  }

  const insertStock = db.prepare(
    "INSERT OR REPLACE INTO stocks (ticker, name, sector) VALUES (?, ?, ?)",
  );
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insertStock.run(row.ticker, row.name, row.sector);
    }
  });
  insertMany(stocks);

  const count = db.prepare("SELECT COUNT(*) as n FROM stocks").get();
  console.log(`Stored ${count.n} stocks in ${DB_PATH}`);

  db.close();
}

function parseStocks(html) {
  const stocks = [];
  const segments = html.split(/data-search="/);

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];

    const qEnd = seg.indexOf('"');
    if (qEnd < 0) continue;
    const ticker = seg.slice(0, qEnd).trim().toUpperCase();
    if (!ticker) continue;

    // Company name from data-title="..."
    const titleMatch = seg.match(/data-title="([^"]+)"/);
    const name = titleMatch ? titleMatch[1].trim() : ticker;

    // Sector code from second <td>
    const sectorMatch = seg.match(/<\/td>\s*<td>(\d{4})<\/td>/);
    const sector = sectorMatch ? sectorMatch[1] : "0818";

    stocks.push({ ticker, name, sector });
  }

  return stocks;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
