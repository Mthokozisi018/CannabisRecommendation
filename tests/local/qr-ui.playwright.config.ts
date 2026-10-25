import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../e2e", testMatch: "qr-registration-ui.spec.ts", workers: 1,
  webServer: { command: "node scripts/test-qr-ui-harness.mjs", cwd: process.cwd(), url: "http://127.0.0.1:3107", reuseExistingServer: false },
  use: { baseURL: "http://127.0.0.1:3107" }
});
