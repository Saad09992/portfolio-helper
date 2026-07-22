import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import { registerApiRoutes } from "./server/api.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "data/psx-stocks.db");
const PORTFOLIO_DB_PATH = resolve(__dirname, "data/portfolio.sqlite");

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
        const app = new Hono();
        registerApiRoutes(app, {
          dbPath: DB_PATH,
          portfolioDbPath: PORTFOLIO_DB_PATH,
        });
        const listener = getRequestListener(app.fetch);
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith("/api/")) return next();
          listener(req, res);
        });
      },
    },
  ],
  test: {
    // Vitest 4 dropped **/dist/** from its default excludes, so compiled test
    // output gets collected alongside the sources it was built from.
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split heavy chart libs into their own cached chunks so the app shell
        // and one big library don't share a single oversized bundle.
        manualChunks: {
          echarts: ["echarts/core", "echarts/charts", "echarts/components", "echarts/renderers"],
          "lightweight-charts": ["lightweight-charts"],
        },
      },
    },
  },
});
