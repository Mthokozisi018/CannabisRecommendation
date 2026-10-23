import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  testIgnore: "qr-registration-ui.spec.ts",
  workers: 1,
  use: {
    baseURL: "https://greenchoice-workstation-staging.vercel.app",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
});
