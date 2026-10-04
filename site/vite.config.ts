import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Static, read-only page. Relative base so the build can be served from any sub-path (e.g. GitHub Pages /sworn/).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { fs: { allow: [".."] } },
  build: { outDir: "dist", target: "es2022", sourcemap: false },
  test: { environment: "node", testTimeout: 120_000, hookTimeout: 120_000 },
});
