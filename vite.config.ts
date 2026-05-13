import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createApiMiddleware } from "./server/api.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "data/psx-stocks.db");
const PORTFOLIO_PATH = resolve(__dirname, "data/portfolio.json");

// Set BASE_PATH=/psx/ (etc) when deploying behind a path-based reverse proxy.
// Leave unset for root deploys or host-based routing.
const BASE = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    {
      name: "psx-market-api",
      configureServer(server) {
        const api = createApiMiddleware({
          dbPath: DB_PATH,
          portfolioPath: PORTFOLIO_PATH,
        });
        server.middlewares.use(api);
      },
    },
  ],
});
