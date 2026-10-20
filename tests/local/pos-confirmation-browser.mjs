import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

process.env.POS_CONFIRMATION_BROWSER = '1';
const { db, uuid } = await import('./pos-confirmation-database.mjs');
const out = 'tmp/pos-confirmation';
mkdirSync(out, { recursive: true });
execFileSync(process.execPath, ['node_modules/tailwindcss/lib/cli.js', '-i', 'app/globals.css', '-o', `${out}/style.css`], { stdio: 'pipe' });
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{ReceptionistPOS}from'./components/receptionist/pos/ReceptionistPOS';
const product={id:'${uuid(31)}',name:'Synthetic product',categoryName:'Accessories',categorySlug:'accessories',subcategory:'Grinders',cultivationType:null,description:'Local fixture',imageUrl:null,imagePath:null,sizeLabel:null,strainType:null,sellingPrice:750,productStatus:'active',isActive:true,isNew:false,quantityAvailable:100,lowStockThreshold:5};
createRoot(document.getElementById('root')).render(<ReceptionistPOS products={[product]} categories={[{name:'Accessories',slug:'accessories',count:1}]} profileLabel="Local Test" checkoutAction={async(input)=>fetch('/checkout',{method:'POST',body:JSON.stringify(input)}).then(r=>r.json())}/>);`;
await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, outfile: `${out}/browser.js`, jsx: 'automatic', plugins: [{ name: 'test-server-boundaries', setup(b) {
  b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'test' }));
  b.onResolve({ filter: /^@\/(app\/dashboard\/receptionist\/(actions|transactions)|components\/GreenChoiceDashboard|components\/account\/DashboardAccountMenu)$/ }, args => ({ path: args.path, namespace: 'test' }));
  b.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === 'link' ? `import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}` : args.path.includes('GreenChoiceDashboard') ? `export function Money({value}){return 'R'+Number(value).toFixed(2)}` : args.path.includes('DashboardAccountMenu') ? `export function DashboardAccountPanel(){return null}` : args.path.endsWith('/transactions') ? `const call=(path,input)=>fetch(path,{method:'POST',body:JSON.stringify(input)}).then(r=>r.json());export const getPOSReceiptAction=id=>call('/receipt',{id});export const searchPOSTransactionsAction=input=>call('/history',input);export const amendPOSTransactionAction=input=>call('/amend',input);` : `export async function checkoutReceptionistSaleAction(){throw Error('Unexpected real checkout')};export async function registerReceptionistCustomerAction(){throw Error('Not used')}`, loader: 'js', resolveDir: process.cwd() }));
} }] });
let failCheckout = false;
let amendmentRequests = 0;
async function receipt(id) {
  await db.exec(`set role authenticated; set test.store='${uuid(1)}'`);
  try { return (await db.query('select get_pos_receipt($1,$2) r', [id, uuid(1)])).rows[0].r; }
  finally { await db.exec('reset role'); }
}
const server = createServer(async (req, res) => {
  if (req.url === '/browser.js' || req.url === '/style.css') { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(`${out}${req.url}`)); return; }
  if (req.method === 'POST') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const data = JSON.parse(raw); res.setHeader('Content-Type', 'application/json');
    try {
      if (req.url === '/checkout') {
        if (failCheckout) { failCheckout = false; throw Error('Synthetic checkout failure'); }
        await db.exec('set role service_role');
        let result;
        try { result = (await db.query('select * from complete_receptionist_sale_v3($1,$2,$3,$4::jsonb,$5,$6,$7)', [data.checkoutId, uuid(11), data.customerId, JSON.stringify(data.items), data.payment.method, data.payment.cashAmount, data.payment.cardAmount])).rows[0]; }
        finally { await db.exec('reset role'); }
        res.end(JSON.stringify({ ok: true, saleId: result.sale_id, message: 'Saved' })); return;
      }
      if (req.url === '/receipt') { res.end(JSON.stringify({ ok: true, receipt: await receipt(data.id) })); return; }
      if (req.url === '/history') {
        await db.exec(`set role authenticated; set test.store='${uuid(1)}'`);
        const result = await db.query('select search_pos_transactions($1,$2,$3,$4) r', [uuid(1), data.search, data.date || null, data.page * 20]); await db.exec('reset role');
        res.end(JSON.stringify({ ok: true, receipts: result.rows[0].r })); return;
      }
      if (req.url === '/amend') {
        amendmentRequests += 1;
        await db.exec('set role service_role');
        try { await db.query('select amend_pos_transaction($1,$2,$3,$4,$5,$6,$7::jsonb,$8)', [data.saleId, uuid(11), data.requestId, data.version, data.kind, data.reason, JSON.stringify(data.payment), data.returnedExternally]); }
        finally { await db.exec('reset role'); }
        res.end(JSON.stringify({ ok: true, receipt: await receipt(data.saleId) })); return;
      }
      res.end(JSON.stringify({ ok: true, customers: [{ id: uuid(51), firstName: 'Alice', surname: 'Local', fullName: 'Alice Local', phoneNumber: '082 000 0001' }] }));
    } catch (error) { res.end(JSON.stringify({ ok: false, message: error.message })); }
    return;
  }
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="background:#07100c"><div id="root"></div><script src="/browser.js"></script></body></html>');
});
await new Promise(resolve => server.listen(3018, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport }); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:3018') ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:3018');
    await page.getByRole('button', { name: 'Accessories', exact: true }).click();
    await page.getByRole('button', { name: /Grinders/ }).click();
    const toolbarButtons = page.locator('[aria-label="Customer registration"] > button');
    assert.deepEqual(await toolbarButtons.allTextContents(), ['Previous Transactions', 'Register Customer', 'QR Code']);
    const toolbarBoxes = await Promise.all((await toolbarButtons.all()).map(button => button.boundingBox()));
    assert.ok(toolbarBoxes.every(box => Math.abs(box.y - toolbarBoxes[0].y) < 2));
    assert.ok(toolbarBoxes[0].x < toolbarBoxes[1].x && toolbarBoxes[1].x < toolbarBoxes[2].x);
    assert.equal(await page.getByRole('button', { name: 'Previous Transactions', exact: true }).count(), 1);
    let failHistoryOnce = false;
    await page.route('**/history', async route => {
      await new Promise(resolve => setTimeout(resolve, 450));
      if (failHistoryOnce) { failHistoryOnce = false; await route.fulfill({ json: { ok: false, message: 'Synthetic history failure' } }); }
      else await route.continue();
    });
    await page.getByRole('button', { name: 'Previous Transactions', exact: true }).click();
    const historyModal = page.locator('.gc-sale-dialog');
    const loading = historyModal.getByRole('status', { name: 'Loading transactions', exact: true });
    const historySearch = historyModal.getByLabel('Search customer, phone or reference');
    const historyDate = historyModal.getByLabel('Transaction date');
    await loading.waitFor();
    assert.equal(await historyModal.getByRole('heading', { name: 'Previous Transactions' }).isVisible(), true);
    assert.equal(await historySearch.isEnabled(), true); assert.equal(await historyDate.isEnabled(), true);
    const filterBoxes = await Promise.all([historySearch, historyDate].map(input => input.boundingBox()));
    const spinnerBox = await loading.boundingBox(); const resultsBox = await historyModal.getByRole('region', { name: 'Transaction results' }).boundingBox();
    assert.ok(spinnerBox.y >= Math.max(...filterBoxes.map(box => box.y + box.height)));
    assert.ok(Math.abs(spinnerBox.x + spinnerBox.width / 2 - resultsBox.x - resultsBox.width / 2) < 2);
    assert.equal(await historyModal.getByText(/^Loading transaction[^s]/).count(), 0);
    await page.screenshot({ path: `${out}/history-loading-${viewport.width}.png` });
    await loading.waitFor({ state: 'detached' });
    await historySearch.fill('Alice');
    await loading.waitFor();
    await historySearch.fill('');
    assert.equal(await loading.isVisible(), true); // Rapid undo must still show the active request.
    await loading.waitFor({ state: 'detached' });
    await historySearch.fill('No matching synthetic customer');
    await loading.waitFor(); await loading.waitFor({ state: 'detached' });
    await historyModal.getByText('No transactions found.', { exact: true }).waitFor();
    await historySearch.fill('');
    await historyDate.fill('2000-01-01');
    await loading.waitFor(); await loading.waitFor({ state: 'detached' });
    await historyModal.getByText('No transactions found.', { exact: true }).waitFor();
    failHistoryOnce = true;
    await historyDate.fill('');
    await loading.waitFor();
    await historyModal.getByText('Synthetic history failure', { exact: false }).waitFor();
    assert.equal(await historyModal.getByText('No transactions found.', { exact: true }).count(), 0);
    await historyModal.getByRole('button', { name: 'Retry', exact: true }).click();
    await loading.waitFor(); await loading.waitFor({ state: 'detached' });
    await historyModal.getByRole('button').filter({ hasText: 'Alice Local' }).first().waitFor();
    await historyModal.getByRole('button', { name: 'Close transaction details', exact: true }).click();

    for (const method of ['Cash', 'Card', 'Split']) {
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
      await page.getByRole('button', { name: 'Checkout (1)', exact: true }).click();
      await page.getByRole('textbox', { name: 'Customer search' }).fill('Alice');
      await page.getByRole('button', { name: 'Select Alice Local' }).click();
      await page.locator('label').filter({ has: page.getByRole('radio', { name: method, exact: true }) }).click();
      if (method === 'Split') { await page.getByLabel('Cash amount', { exact: true }).fill('300'); await page.getByLabel('Card amount', { exact: true }).fill('450'); }
      if (method === 'Cash') {
        failCheckout = true;
        await page.getByRole('button', { name: 'Complete sale for Alice Local' }).click();
        await page.getByText('Synthetic checkout failure', { exact: true }).first().waitFor();
        assert.equal(await page.getByRole('heading', { name: 'Sale Completed Successfully' }).count(), 0);
      }
      await page.getByRole('button', { name: 'Complete sale for Alice Local' }).click();
      await page.getByRole('heading', { name: 'Sale Completed Successfully' }).waitFor();
      const modal = page.locator('.gc-sale-dialog');
      assert.equal(await modal.getByText('Alice Local', { exact: true }).count(), 1);
      assert.ok(await modal.getByRole('cell', { name: /750/ }).count() >= 2);
      const box = await modal.boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.width <= viewport.width && box.height <= viewport.height);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (method === 'Split') {
        await page.screenshot({ path: `${out}/sale-${viewport.width}.png` });
        await modal.getByRole('button', { name: 'Change Payment Method', exact: true }).click();
        const beforeCorrections = amendmentRequests;
        await modal.getByRole('heading', { name: 'Change Payment Method', exact: true }).waitFor();
        assert.equal(await modal.getByRole('combobox').count(), 0);
        assert.equal(await modal.getByText('Alice Local', { exact: true }).count(), 0);
        assert.equal(await modal.getByText('Products Purchased', { exact: true }).count(), 0);
        assert.ok((await modal.getByText('Original Payment Method:').textContent()).includes('Split Payment'));
        const correctionBox = await modal.boundingBox();
        assert.ok(correctionBox.width <= 520 && Math.abs(correctionBox.x + correctionBox.width / 2 - viewport.width / 2) < 2);
        const cardOption = modal.getByRole('button', { name: 'Change to Card', exact: true });
        const cashOption = modal.getByRole('button', { name: 'Change to Cash', exact: true });
        const splitOption = modal.getByRole('button', { name: 'Split Payment', exact: true });
        const optionBoxes = await Promise.all([cardOption, cashOption, splitOption].map(option => option.boundingBox()));
        assert.ok(optionBoxes.every(box => Math.abs(box.y - optionBoxes[0].y) < 2));
        await cardOption.click();
        assert.equal(await cardOption.getAttribute('aria-pressed'), 'true');
        assert.equal(await modal.getByRole('button', { name: 'Confirm Change', exact: true }).isEnabled(), false);
        await modal.getByLabel('Reason for Change', { exact: true }).fill('Wrong tender entered during checkout');
        await modal.getByRole('button', { name: 'Confirm Change', exact: true }).click();
        await modal.getByRole('heading', { name: 'Confirm Payment Change', exact: true }).waitFor();
        assert.ok((await modal.getByText('New Payment Method:').textContent()).includes('Card'));
        assert.equal(amendmentRequests, beforeCorrections);
        await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
        await modal.getByRole('button', { name: 'Change Payment Method', exact: true }).click();
        assert.equal(amendmentRequests, beforeCorrections);
        await modal.getByRole('button', { name: 'Split Payment', exact: true }).click();
        await modal.getByLabel('Cash Amount', { exact: true }).fill('300');
        await modal.getByLabel('Card Amount', { exact: true }).fill('449');
        await modal.getByLabel('Reason for Change', { exact: true }).fill('Wrong tender entered during checkout');
        assert.equal(await modal.getByRole('button', { name: 'Confirm Change', exact: true }).isEnabled(), false);
        await modal.getByLabel('Card Amount', { exact: true }).fill('450');
        // This is the original allocation, so no correction should be submitted.
        assert.equal(await modal.getByRole('button', { name: 'Confirm Change', exact: true }).isEnabled(), false);
        await modal.getByLabel('Cash Amount', { exact: true }).fill('250');
        await modal.getByLabel('Card Amount', { exact: true }).fill('500');
        assert.equal(await modal.getByRole('button', { name: 'Confirm Change', exact: true }).isEnabled(), true);
        await page.screenshot({ path: `${out}/payment-correction-${viewport.width}.png` });
        await modal.getByRole('button', { name: 'Change to Cash', exact: true }).click();
        await modal.getByRole('button', { name: 'Confirm Change', exact: true }).click();
        await modal.getByRole('button', { name: 'Confirm and Save', exact: true }).click();
        await modal.getByRole('button', { name: 'Change Payment Method', exact: true }).waitFor();
        assert.equal(amendmentRequests, beforeCorrections + 1);
        await modal.getByRole('button', { name: 'Change Payment Method', exact: true }).click();
        assert.ok((await modal.getByText('Original Payment Method:').textContent()).includes('Split Payment'));
        await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
        await modal.getByRole('button', { name: 'Refund Transaction', exact: true }).waitFor();
        await modal.getByRole('button', { name: 'Refund Transaction', exact: true }).click();
        assert.equal(await modal.getByRole('button', { name: 'Review change' }).isEnabled(), false);
        await modal.getByLabel(/I confirm the money/).check();
        await modal.getByLabel('Required reason').fill('Customer returned purchase; money returned externally');
        await modal.getByRole('button', { name: 'Review change' }).click();
        await modal.getByRole('button', { name: 'Confirm and save' }).click();
        await modal.getByText(/Refund recorded:/).waitFor();
        assert.equal(await modal.getByRole('button', { name: 'Refund Transaction', exact: true }).isEnabled(), false);
        await modal.getByRole('button', { name: 'View Previous Transactions', exact: true }).click();
        await modal.getByLabel('Search customer, phone or reference').fill('Alice');
        await modal.getByRole('button').filter({ hasText: 'Alice Local' }).first().waitFor();
        await modal.getByRole('button').filter({ hasText: 'Alice Local' }).first().click();
      }
      await modal.getByRole('button', { name: 'Continue Selling', exact: true }).click();
      await modal.waitFor({ state: 'detached' });
      assert.equal(await page.getByRole('button', { name: 'Checkout', exact: true }).isEnabled(), false);
    }
    await db.exec(`insert into pos_sales(id,checkout_id,store_id,staff_user_id,customer_id,subtotal,total,payment_method,cash_amount,card_amount,payment_status)
      values('${uuid(viewport.width)}','${uuid(viewport.width + 10000)}','${uuid(1)}','${uuid(11)}','${uuid(51)}',750,750,'cash',750,0,'paid');
      insert into pos_sale_items(sale_id,product_id,product_name_snapshot,category_snapshot,unit_price,quantity,line_total)
      select '${uuid(viewport.width)}','${uuid(31)}',repeat('Long purchased product name ',12) || n,'Accessories',12.50,1,12.50 from generate_series(1,60) n;`);
    await page.getByRole('button', { name: 'Previous Transactions', exact: true }).click();
    await page.getByLabel('Search customer, phone or reference').fill(uuid(viewport.width + 10000));
    await page.locator('.gc-sale-dialog').getByRole('button').filter({ hasText: 'Alice Local' }).click();
    await page.getByRole('heading', { name: 'Transaction Details', exact: true }).waitFor();
    assert.equal(await page.locator('.gc-sale-products tbody tr').count(), 60);
    assert.ok(await page.locator('.gc-sale-table-scroll').evaluate(node => node.scrollHeight > node.clientHeight));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${out}/many-products-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Continue Selling', exact: true }).click();
    assert.deepEqual(errors, []); await page.close();
    console.log(`PASS ${viewport.width}x${viewport.height}: real PostgreSQL checkout -> saved confirmation, failed checkout, Cash/Card/Split, correction, refund, audit/history, reset, contained responsive modal, no JS errors`);
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await db.close(); }
