import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The browser talks to the local demo backend (which holds the keys) only through /api.
const backend = process.env.DEMO_BACKEND_ORIGIN ?? "http://127.0.0.1:8788";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": backend } },
  preview: { proxy: { "/api": backend } },
  test: { environment: "node", testTimeout: 60_000, hookTimeout: 120_000 },
});
