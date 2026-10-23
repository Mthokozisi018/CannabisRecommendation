import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    projects: [
      { extends: true, test: { name: "node", environment: "node", include: ["tests/**/*.test.{ts,tsx}"], exclude: ["tests/unit/franchise-ui.test.tsx", "tests/unit/manager-refund-ui.test.tsx"] } },
      { extends: true, test: { name: "ui", environment: "jsdom", include: ["tests/unit/franchise-ui.test.tsx", "tests/unit/manager-refund-ui.test.tsx"] } }
    ],
    // Cold Next imports and WASM database startup need bounded headroom under CI load.
    testTimeout: 30000,
    hookTimeout: 30000,
    maxWorkers: 4
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname
    }
  }
});
