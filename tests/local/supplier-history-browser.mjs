// Run: node --import=tsx tests/local/supplier-history-browser.mjs
// Real UI + report builder, synthetic read responses, blocked writes. No database access.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { buildSupplyReport, parseSupplyFilters } from "../../lib/manager/supply-report-model.ts";
import { supplySource, delivery, line } from "../fixtures/supply-report.ts";
import { supplier, history } from "../fixtures/supplier-history.ts";

const root = process.cwd(), out = "tmp/supplier-history-verification";
mkdirSync(out, { recursive: true });
execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", `${out}/style.css`], { stdio: "pipe" });
await build({
  stdin: { resolveDir: root, loader: "tsx", contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {SupplierManagement} from './components/manager/SupplierManagement';createRoot(document.getElementById('root')).render(<SupplierManagement storeName="Test Store" managerName="Test Manager" initialReport={window.__SUPPLY_REPORT__}/>);` },
  bundle: true, platform: "browser", outfile: `${out}/browser.js`, jsx: "automatic", alias: { "@": root },
  plugins: [{ name: "synthetic-boundaries", setup(b) {
    b.onResolve({ filter: /^next\/(image|navigation)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    b.onResolve({ filter: /^@\/app\/dashboard\/manager\/suppliers\/actions$/ }, () => ({ path: "actions", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", resolveDir: root, contents:
      args.path === "next/navigation" ? "export function useRouter(){return {refresh(){}}}"
      : args.path === "next/image" ? "import React from 'react';export default function Image({unoptimized,...props}){return React.createElement('img',props)}"
      : "export async function refreshManagerSupplyReport(input){return fetch('/report',{method:'POST',body:JSON.stringify(input)}).then(r=>r.json())};export async function loadManagerSupplierProfile(id){return fetch('/profile',{method:'POST',body:JSON.stringify({id})}).then(r=>r.json())};export async function saveSupplierAction(){throw Error('Unexpected write')};export async function archiveSupplierAction(){throw Error('Unexpected write')}"
    }));
  } }],
});
const pageSource = { ...supplySource, deliveries: Array.from({ length: 21 }, (_, i) => delivery(`page-${i}`, "2026-10-08T08:00:00Z")), items: Array.from({ length: 21 }, (_, i) => line(`page-line-${i}`, `page-${i}`)) };
let activeSource = supplySource;
let searchRequests = 0;
const server = createServer(async (req, res) => {
  const asset = { "/browser.js": ["text/javascript", "browser.js"], "/browser.css": ["text/css", "browser.css"], "/style.css": ["text/css", "style.css"] }[req.url];
  if (asset) { res.setHeader("Content-Type", asset[0]); res.end(readFileSync(`${out}/${asset[1]}`)); return; }
  if (req.url === "/report" || req.url === "/profile") {
    let body = ""; for await (const chunk of req) body += chunk;
    res.setHeader("Content-Type", "application/json");
    const input = JSON.parse(body);
    if (req.url === "/report") { if (input.search) searchRequests++; res.end(JSON.stringify({ ok: true, report: buildSupplyReport(activeSource, parseSupplyFilters(input)) })); }
    else { const entry = activeSource.suppliers.find(row => row.id === input.id); res.end(JSON.stringify(entry ? { ok: true, supplier: { ...supplier(entry.id, entry.name), status: entry.status }, history: history.filter(row => row.supplierId === entry.id) } : { ok: false, message: "Supplier unavailable" })); }
    return;
  }
  activeSource = req.url === "/pages" ? pageSource : supplySource;
  const seed = buildSupplyReport(activeSource, parseSupplyFilters({ month: "2026-10" }));
  res.setHeader("Content-Type", "text/html");
  res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script>window.__SUPPLY_REPORT__=${JSON.stringify(seed).replace(/</g, "\\u003c")}</script><script src="/browser.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(3018, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 1024, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, timezoneId: "America/Los_Angeles" });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-10-08T08:00:00Z") });
    await page.goto("http://127.0.0.1:3018");
    const records = page.locator("[data-supply-transaction]");
    await expect(page.getByLabel("Supply month")).toHaveValue("2026-10");
    await expect(records).toHaveCount(2); await expect(page.locator("[data-archive-row]")).toHaveCount(0);
    await page.getByRole("button", { name: "Expand supply SUP-oct-1", exact: true }).click();
    const products = page.getByRole("table", { name: "Products for SUP-oct-1", exact: true });
    await expect(products.locator("tbody tr")).toHaveCount(2);
    await expect(products).toContainText("Product flower"); await expect(products).toContainText("Product accessory");
    await expect(products).toContainText("Unit Cost"); await expect(products).toContainText("150");
    await page.getByLabel("Supply category").selectOption("Flower");
    await expect(records).toHaveCount(2);
    await page.getByLabel("Recorded by filter").selectOption("manager-a"); await expect(records).toHaveCount(1);
    await page.getByRole("button", { name: "Expand supply SUP-oct-1", exact: true }).click();
    await expect(products).toContainText("Accessories"); await expect(products).toContainText("150");
    const productsKpi = page.locator('[aria-label="Filtered supply summary"] article').filter({ has: page.getByRole("heading", { name: "Products Received", exact: true }) });
    await expect(productsKpi.locator("p").first()).toHaveText("2");
    await expect(productsKpi).toContainText("Total unique products received.");
    await page.screenshot({ path: `${out}/transactions-${width}.png`, fullPage: true, animations: "disabled" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByLabel("Recorded by filter").selectOption("manager-b"); await expect(records).toHaveCount(1);
    await expect(records).toHaveAttribute("data-supply-transaction", "oct-2");
    await page.getByLabel("Recorded by filter").selectOption("all");
    await page.getByLabel("Supply category").selectOption("all");
    await page.getByLabel("Supply month").fill("2026-09"); await expect(records).toHaveCount(2);
    await page.getByLabel("Supply week").selectOption("2026-09-07"); await expect(records).toHaveCount(1);
    await expect(records).toHaveAttribute("data-supply-transaction", "sept-1");
    await page.getByLabel("Supply week").selectOption("2026-09-14");
    await expect(page.getByText("No supplies recorded during the selected week.", { exact: true })).toBeVisible();
    await page.getByLabel("Supply month").fill("2026-10"); await expect(records).toHaveCount(2);
    await expect(page.getByLabel("Supply week")).toHaveValue("all");
    searchRequests = 0; await page.getByLabel("Search supplies").pressSequentially("BuD", { delay: 25 });
    await page.clock.runFor(400); await expect(page.getByLabel("Supply month")).toBeEnabled();
    await expect(records).toHaveCount(2); assert.equal(searchRequests, 1);
    await page.getByLabel("Search supplies").fill("absent"); await page.clock.runFor(400);
    await expect(page.getByText("No matching supplies found.", { exact: true })).toBeVisible();
    await page.getByLabel("Search supplies").fill(""); await page.clock.runFor(400); await expect(records).toHaveCount(2);
    await page.getByLabel("Supply month").fill("2026-11");
    await expect(page.getByText("No supplies recorded for November 2026.", { exact: true })).toBeVisible();
    await page.getByLabel("Supply month").fill("2026-09"); await expect(records).toHaveCount(2);
    await page.getByLabel("Supply supplier").selectOption("budhouse"); await expect(records).toHaveCount(1);
    await expect(page.getByLabel("Supply month")).toHaveValue("2026-09");
    await page.getByLabel("Supplier profile", { exact: true }).selectOption("never");
    await page.getByRole("button", { name: "View supplier profile", exact: true }).click();
    const profile = page.getByRole("dialog", { name: "Supplier details", exact: true });
    await expect(profile.getByRole("heading", { name: "Never Supplied", exact: true })).toBeVisible();
    await profile.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Register supplier", exact: true }).click();
    const registration = page.getByRole("dialog", { name: "Register supplier", exact: true });
    await expect(registration.locator('input[name="name"]')).toBeVisible();
    await registration.getByRole("button", { name: "Close", exact: true }).click();
    assert.deepEqual(errors, []);
    results.push({ width, checks: "Current month; ID filters; complete mixed-category costs and quantities; month/week boundaries; debounced search; honest empty states; supplier profile and registration access; no viewport overflow or runtime errors" });
    await page.close();
  }
  const page = await browser.newPage(); await page.goto("http://127.0.0.1:3018/pages");
  await expect(page.locator("[data-supply-transaction]")).toHaveCount(10);
  const productsKpi = page.locator('[aria-label="Filtered supply summary"] article').filter({ has: page.getByRole("heading", { name: "Products Received", exact: true }) });
  await expect(productsKpi.locator("p").first()).toHaveText("21");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 3", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Supply month")).toHaveValue("2026-10");
  await page.getByRole("button", { name: "Next", exact: true }).click(); await expect(page.locator("[data-supply-transaction]")).toHaveCount(1);
  await page.getByLabel("Supply category").selectOption("Flower"); await expect(page.getByText("Page 1 of 3", { exact: false })).toBeVisible();
  await page.close(); results.push({ checks: "Server-sized result pages, full-filter totals, active filters preserved through pagination, filter changes reset page" });
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
