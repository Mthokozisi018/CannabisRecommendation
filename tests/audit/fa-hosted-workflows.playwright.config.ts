import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'..',testMatch:['**/franchise-administration.spec.ts','**/fa-current-contract.pw.ts','**/fa-direct-navigation.spec.pw.ts'],workers:1,use:{baseURL:'http://127.0.0.1:3001'}});
