import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'fa-ui.pw.ts',workers:1,webServer:{cwd:process.cwd(),command:'node scripts/test-franchise-overview-harness.mjs',url:'http://127.0.0.1:3113',reuseExistingServer:true},use:{baseURL:'http://127.0.0.1:3113'}});
