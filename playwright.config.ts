import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "qr-registration-ui.spec.ts", // Uses its own isolated component/API harness.
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:3001"
  }
});
