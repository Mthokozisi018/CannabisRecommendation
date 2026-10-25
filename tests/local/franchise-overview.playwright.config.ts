import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: ["franchise-stores-loading.spec.ts", "franchise-manager-logins.spec.ts", "franchise-store-directory.spec.ts", "franchise-sales-filters.spec.ts", "store-sales-filters.spec.ts", "franchise-sales-loading.spec.ts", "franchise-chart-axes.spec.ts", "franchise-graph-expansion.spec.ts"],
  workers: 1,
  webServer: {
    command: "node scripts/test-franchise-overview-harness.mjs",
    cwd: process.cwd(),
    url: "http://127.0.0.1:3113",
    reuseExistingServer: false,
  },
  use: { baseURL: "http://127.0.0.1:3113" },
});
