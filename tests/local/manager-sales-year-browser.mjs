import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const refundFixture = process.env.GREENCHOICE_REFUND_BROWSER_FIXTURE === 'true';
const annualRevenueLabel = refundFixture ? '800,00' : '900,00';
const out = refundFixture ? 'tmp/manager-refund-badges' : 'tmp/manager-sales-year'; mkdirSync(out, { recursive: true });
execFileSync(process.execPath, ['node_modules/tailwindcss/lib/cli.js', '-i', 'app/globals.css', '-o', `${out}/style.css`], { stdio: 'pipe' });
const source = {
  sales: [
    { id: 'sale-a', checkout_id: 'RCPT-100', customer_id: 'customer-a', staff_user_id: 'staff-a', payment_method: 'card', total: 125, refunded_amount: refundFixture ? 125 : 25, created_at: '2026-10-01T08:00:00Z' },
    { id: 'sale-b', checkout_id: 'RCPT-101', customer_id: 'customer-a', staff_user_id: 'staff-a', payment_method: 'cash', total: 50, refunded_amount: 0, created_at: '2026-10-02T08:00:00Z' }
  ],
  items: [
    { sale_id: 'sale-a', product_name_snapshot: 'Blue Dream', category_snapshot: 'Flower', subcategory_snapshot: 'Hybrid', unit_price: 125, quantity: 1, line_total: 125 },
    { sale_id: 'sale-b', product_name_snapshot: 'Gummies', category_snapshot: 'Edibles', subcategory_snapshot: 'Gummies', unit_price: 50, quantity: 1, line_total: 50 }
  ],
  customers: [{ id: 'customer-a', full_name: 'Synthetic Customer', phone_display: '082 000 0000' }],
  staff: [{ auth_user_id: 'staff-a', full_name: 'Synthetic Staff' }]
};
const calendar = { weekSales: source.sales.slice(0, 1), monthSales: source.sales, yearSales: [...source.sales, { id: 'year-only', total: 1000, refunded_amount: 250, created_at: '2026-01-01T08:00:00Z' }], currentWeekLabel: 'Current calendar week', currentMonthLabel: 'October 2026', currentYearLabel: '2026' };
const fixture = `import {buildManagerSalesReport,parseSalesReportFilters} from '@/lib/manager/sales-overview';const source=${JSON.stringify(source)},calendar=${JSON.stringify(calendar)};export function makeReport(filters={month:'2026-10'}){return buildManagerSalesReport(source,parseSalesReportFilters(filters),true,calendar)}`;
function plugin() { return { name: 'isolated-manager-test', setup(b) {
  b.onResolve({ filter: /^(server-only|test-fixture|next\/link|@\/lib\/(supabase\/server|logger)|@\/app\/dashboard\/manager\/sales\/actions|@\/components\/(DashboardBackdrop|receptionist\/pos\/TransactionWorkspace))$/ }, args => ({ path: args.path, namespace: 'test' }));
  b.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => ({ resolveDir: process.cwd(), loader: 'jsx', contents:
    path === 'test-fixture' ? fixture :
    path === 'next/link' ? `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}` :
    path.includes('/sales/actions') ? `import {makeReport} from 'test-fixture';export async function refreshManagerSalesReport(filters){return {ok:true,report:makeReport(filters)}}` :
    path.includes('DashboardBackdrop') ? 'export function DashboardBackdrop(){return null}' :
    path.includes('TransactionWorkspace') ? 'export function TransactionDetailsButton(){return null}' :
    path.includes('supabase/server') ? 'export async function createSupabaseServerClient(){throw Error("Unexpected database access in browser fixture")}' :
    path.includes('logger') ? 'export async function logServerEvent(){}' : ''
  }));
} }; }
await build({ stdin: { contents: `export {makeReport} from 'test-fixture';export {buildManagerSalesReportPdf} from '@/lib/manager/sales-report-pdf';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: `${out}/model.mjs`, plugins: [plugin()] });
const model = await import(pathToFileURL(resolve(`${out}/model.mjs`)).href);
await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ManagerSalesOverviewUI} from '@/components/manager/ManagerSalesOverviewUI';import {makeReport} from 'test-fixture';createRoot(document.getElementById('root')).render(<ManagerSalesOverviewUI initialReport={makeReport()} storeName="Synthetic Store" managerName="Test Manager"/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, jsx: 'automatic', outfile: `${out}/browser.js`, plugins: [plugin()] });
let exportFilters;
const server = createServer(async (req, res) => {
  if (req.url === '/browser.js' || req.url === '/style.css') { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(`${out}${req.url}`)); return; }
  if (req.method === 'POST') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    exportFilters = JSON.parse(raw);
    const pdf = model.buildManagerSalesReportPdf({ report: model.makeReport(exportFilters), storeName: 'Synthetic Store', generatedAt: new Date() });
    res.setHeader('Content-Type', 'application/pdf'); res.end(pdf); return;
  }
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/browser.js"></script></body></html>');
});
await new Promise(done => server.listen(3019, '127.0.0.1', done));
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport }); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3019');
    const kpis = page.getByRole('region', { name: 'Sales KPIs', exact: true });
    await kpis.waitFor();
    const cards = kpis.locator(':scope > section');
    assert.equal(await cards.count(), 5);
    assert.deepEqual(await cards.locator('div > span.font-extrabold').allTextContents(), ['Revenue This Week', 'Revenue This Month', 'Revenue This Year', 'Total Customers', 'Total Transactions']);
    assert.equal(await page.getByRole('heading', { name: 'Sales Overview', exact: true }).count(), 0);
    assert.equal(await page.getByText('Reporting', { exact: true }).count(), 0);
    const boxes = await Promise.all((await cards.all()).map(card => card.boundingBox()));
    assert.ok(boxes.every(box => Math.abs(box.height - boxes[0].height) < 2));
    if (viewport.width >= 1280) assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) < 2));
    const back = await page.getByRole('link', { name: 'Back to manager dashboard' }).boundingBox();
    const exportButton = await page.getByRole('button', { name: 'Export filtered PDF' }).boundingBox();
    assert.ok(boxes[0].y - Math.max(back.y + back.height, exportButton.y + exportButton.height) <= 24);
    assert.ok(await cards.nth(2).innerText().then(text => text.includes(annualRevenueLabel) && text.includes('2026')));
    const filters = page.getByRole('region', { name: 'Sales report controls' });
    assert.deepEqual(await filters.locator('label').evaluateAll(nodes => nodes.map(node => node.childNodes[0].textContent)), ['Month', 'Week', 'Receptionist', 'Category', 'Search']);
    assert.ok((await filters.boundingBox()).y >= Math.max(...boxes.map(box => box.y + box.height)));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (refundFixture) {
      const refunded = page.getByRole('button', { name: /RCPT-100/ });
      assert.equal(await refunded.getByText('Refunded', { exact: true }).isVisible(), true);
      assert.ok((await refunded.innerText()).includes('125,00'));
      assert.equal(await page.getByRole('button', { expanded: false }).filter({ hasText: 'RCPT-101' }).getByText('Refunded', { exact: true }).count(), 0);
      await refunded.click();
      assert.equal(await refunded.getAttribute('aria-expanded'), 'true');
      await refunded.click();
      assert.equal(await refunded.getAttribute('aria-expanded'), 'false');
      assert.equal(await refunded.getByText('Refunded', { exact: true }).isVisible(), true);
    }
    await page.screenshot({ path: `${out}/kpis-${viewport.width}.png`, fullPage: true });
    await page.getByLabel('Category filter').selectOption('Flower');
    await page.getByRole('button', { expanded: false }).filter({ hasText: 'RCPT-101' }).waitFor({ state: 'detached' });
    assert.equal(await cards.nth(2).innerText().then(text => text.includes(annualRevenueLabel)), true);
    await page.getByLabel('Search transactions').fill('no matching transaction');
    await page.getByRole('heading', { name: 'Nothing to show' }).waitFor();
    assert.equal(await cards.nth(2).innerText().then(text => text.includes(annualRevenueLabel)), true);
    await page.getByLabel('Search transactions').fill('Blue Dream');
    await page.getByRole('button', { expanded: false }).filter({ hasText: 'RCPT-100' }).waitFor();
    await page.getByLabel('Report week').selectOption('2026-10-01');
    await page.getByLabel('Receptionist filter').selectOption('Synthetic Staff');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export filtered PDF' }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'greenchoice-sales-2026-10.pdf');
    assert.equal(exportFilters.category, 'Flower'); assert.equal(exportFilters.search, 'Blue Dream'); assert.equal(exportFilters.receptionist, 'Synthetic Staff');
    assert.deepEqual(errors, []); await page.close();
    console.log(`PASS ${viewport.width}x${viewport.height}: five KPIs in order, equal heights, compact placement, responsive layout, filtering preserves annual KPI, PDF export, no overflow/JS errors`);
  }
} finally { await browser.close(); await new Promise(done => server.close(done)); }
