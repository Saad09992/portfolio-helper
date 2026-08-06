import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// Set BASE_PATH=/psx/ (etc) when deploying behind a path-based reverse proxy.
// Leave unset for root deploys or host-based routing (the Workers deploy).
const BASE = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    // Runs worker/index.mjs in workerd during `vite dev`, with a local D1 under
    // .wrangler/state. Replaces the old hand-rolled middleware that mounted the
    // Hono app in-process against better-sqlite3 — dev now exercises the same
    // runtime, bindings and async D1 seam as production.
    //
    // Skipped under Vitest: the plugin defines a worker environment that
    // rejects Vitest's Node externals, and the server tests deliberately run in
    // Node against the better-sqlite3 adapter rather than in workerd.
    ...(process.env.VITEST ? [] : [cloudflare()]),
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
