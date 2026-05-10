import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import { readFile, writeFile, rename } from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "data/psx-stocks.db");
const PORTFOLIO_PATH = resolve(__dirname, "data/portfolio.json");

type Quote = {
  ticker: string;
  ldcp: number;
  open: number;
  high: number;
  low: number;
  current: number;
  change: number;
  changePct: number;
  volume: number;
};

function parsePsxHtml(html: string): Quote[] {
  const quotes: Quote[] = [];
  const segments = html.split(/data-search="/);

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const quoteEnd = seg.indexOf('"');
    if (quoteEnd < 0) continue;
    const ticker = seg.slice(0, quoteEnd).trim().toUpperCase();
    if (!ticker) continue;

    const rowEnd = seg.indexOf("</tr>");
    const rowContent = rowEnd > 0 ? seg.slice(0, rowEnd) : seg.slice(0, 3000);

    const nums: number[] = [];
    const re = /data-order="([^"]+)"/g;
    let m;
    while ((m = re.exec(rowContent)) !== null) {
      const v = parseFloat(m[1]);
      if (Number.isFinite(v)) nums.push(v);
    }

    if (nums.length < 8) continue;
    const current = nums[4];
    if (current <= 0) continue;

    quotes.push({
      ticker,
      ldcp: nums[0],
      open: nums[1],
      high: nums[2],
      low: nums[3],
      current,
      change: nums[5],
      changePct: nums[6],
      volume: Math.round(nums[7]),
    });
  }

  return quotes;
}

async function fetchDividend(
  ticker: string,
): Promise<{ ticker: string; dividendPerShare: number; payoutDate: string } | null> {
  try {
    const res = await fetch("https://dps.psx.com.pk/payouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: `symbol=${encodeURIComponent(ticker)}`,
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Parse rows: each <tr> has <td>Dividend Announcement</td> with pattern like "70%(F) (D)"
    // and Book Closure Date. Face value is Rs 10 by default on PSX.
    const rows = html.split("<tr>").slice(1);
    const faceValue = 10;
    let totalDps = 0;
    let latestDate = "";
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    for (const row of rows) {
      // Extract announcement date
      const dateMatch = row.match(
        /(\w+ \d{1,2}, \d{4})/,
      );
      if (!dateMatch) continue;
      const announcementDate = new Date(dateMatch[1]);
      if (announcementDate < oneYearAgo) continue;

      // Extract dividend percentage like "70%" or "75%"
      const pctMatch = row.match(/(\d+(?:\.\d+)?)%/);
      if (!pctMatch) continue;

      const dps = (parseFloat(pctMatch[1]) / 100) * faceValue;
      totalDps += dps;

      // Track latest book closure date for payoutDate
      const closureMatch = row.match(
        /(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/,
      );
      if (closureMatch && !latestDate) {
        const [d, m, y] = closureMatch[2].split("/");
        latestDate = `${y}-${m}-${d}`;
      }
    }

    if (totalDps <= 0) return null;

    return {
      ticker: ticker.toUpperCase(),
      dividendPerShare: Math.round(totalDps * 100) / 100,
      payoutDate: latestDate,
    };
  } catch {
    return null;
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "psx-market-api",
      configureServer(server) {
        process.stdout.write("[PSX] Plugin hook fired\n");

        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/api/portfolio/load")) {
            (async () => {
              try {
                if (!existsSync(PORTFOLIO_PATH)) {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end("null");
                  return;
                }
                const raw = await readFile(PORTFOLIO_PATH, "utf-8");
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(raw);
              } catch (err) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: String(err) }));
              }
            })();
            return;
          }

          if (req.url?.startsWith("/api/portfolio/save") && req.method === "POST") {
            (async () => {
              try {
                const chunks: Buffer[] = [];
                for await (const chunk of req) {
                  chunks.push(chunk as Buffer);
                }
                const body = Buffer.concat(chunks).toString("utf-8");
                JSON.parse(body); // validate
                mkdirSync(dirname(PORTFOLIO_PATH), { recursive: true });
                const tmp = `${PORTFOLIO_PATH}.tmp`;
                await writeFile(tmp, body, "utf-8");
                await rename(tmp, PORTFOLIO_PATH);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
              } catch (err) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: String(err) }));
              }
            })();
            return;
          }

          if (req.url?.startsWith("/api/psx/stocks")) {
            if (!existsSync(DB_PATH)) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Run npm run fetch-stocks first" }));
              return;
            }

            try {
              const db = new Database(DB_PATH, { readonly: true });
              const rows = db
                .prepare(
                  "SELECT s.ticker, s.name, sec.name as sector FROM stocks s JOIN sectors sec ON s.sector = sec.code ORDER BY s.ticker",
                )
                .all();
              db.close();
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(rows));
            } catch (err) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: err instanceof Error ? err.message : String(err),
                }),
              );
            }
            return;
          }

          if (req.url?.startsWith("/api/psx/dividends")) {
            const params = new URL(req.url, "http://localhost").searchParams;
            const tickers = (params.get("tickers") ?? "").split(",").filter(Boolean);

            if (tickers.length === 0) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "tickers param required" }));
              return;
            }

            process.stdout.write(`[PSX] Fetching dividends for ${tickers.length} tickers\n`);

            Promise.all(tickers.map(fetchDividend))
              .then((results) => {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(results.filter(Boolean)));
              })
              .catch((err) => {
                if (!res.headersSent) {
                  res.writeHead(500, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: String(err) }));
                }
              });
            return;
          }

          if (!req.url?.startsWith("/api/psx/market-data")) {
            return next();
          }

          process.stdout.write(`[PSX] Request: ${req.url}\n`);

          fetch("https://dps.psx.com.pk/market-watch", {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Accept: "text/html,application/xhtml+xml",
            },
          })
            .then((upstream) => {
              if (!upstream.ok) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: `PSX returned ${upstream.status}` }));
                return;
              }
              return upstream.text().then((html) => {
                const quotes = parsePsxHtml(html);
                process.stdout.write(
                  `[PSX] ${html.length} bytes -> ${quotes.length} quotes\n`,
                );
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(quotes));
              });
            })
            .catch((err) => {
              process.stdout.write(`[PSX] Error: ${err}\n`);
              if (!res.headersSent) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    error: err instanceof Error ? err.message : String(err),
                  }),
                );
              }
            });
        });
      },
    },
  ],
});
