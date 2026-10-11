import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Static, read-only page. Relative base so the build can be served from any sub-path (e.g. GitHub Pages /sworn/).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { fs: { allow: [".."] } },
  build: {
    outDir: "dist", target: "es2022", sourcemap: false,
    rollupOptions: { input: { main: resolve(here, "index.html"), evidence: resolve(here, "evidence/index.html") } },
  },
  test: { environment: "node", testTimeout: 120_000, hookTimeout: 120_000 },
});
