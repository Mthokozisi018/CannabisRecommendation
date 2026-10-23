import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { reportPeriod, summarizeFranchiseSales, summarizeSaleItems, type FranchiseSale, type FranchiseSaleItem } from '../lib/franchise/reporting';

const project = 'jezbvjepxosphdrykrcg';
const franchise = 'ec7730b6-27b2-4d86-8ba6-16c387060831';
assert.equal(process.env.GREENCHOICE_ENV, 'staging');
assert.equal(process.env.EXPECTED_SUPABASE_PROJECT_REF, project);
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname, `${project}.supabase.co`);
assert.notEqual(process.env.PRODUCTION_SUPABASE_PROJECT_REF, project);
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(key, 'Staging server credentials required');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function readAll<T>(query: (offset: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query(offset);
    assert.equal(error, null, 'Dashboard query must succeed');
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
async function main() {
const { data: stores, error } = await db.from('stores').select('id,name,slug,franchise_id')
  .eq('franchise_id', franchise).order('id');
assert.equal(error, null);
const demo = stores!.filter(s => s.slug.startsWith('gc-demo-fa-v1-'));
assert.equal(demo.length, 5);
const anchor = new Date('2026-10-12T12:00:00+02:00');
const period = reportPeriod({ from: '2026-07-15', to: '2026-10-12' }, anchor);
// Same table, inner ownership join, completion filter and 500-row pagination as the dashboard DAL.
const sales = await readAll<FranchiseSale>(o => db.from('pos_sales')
  .select('id,store_id,customer_id,staff_user_id,checkout_id,total,payment_method,created_at,stores!inner(franchise_id)')
  .eq('stores.franchise_id', franchise).eq('status', 'completed')
  .gte('created_at', period.start.toISOString()).lt('created_at', period.end.toISOString())
  .order('id').range(o, o + 499));
const summary = summarizeFranchiseSales(sales, period, anchor);
assert.equal(summary.selected.length, 3749);
assert.equal(summary.revenue, 1576775);
assert.equal(summary.month, 236170);
assert.equal(summary.week, 15545);
assert.equal(summary.year, summary.revenue);
let storeCents = 0;
const result = [];
for (const store of demo) {
  const scoped = await readAll<FranchiseSale>(o => db.from('pos_sales')
    .select('id,store_id,customer_id,staff_user_id,checkout_id,total,payment_method,created_at,stores!inner(franchise_id)')
    .eq('stores.franchise_id', franchise).eq('store_id', store.id).eq('status', 'completed')
    .gte('created_at', period.start.toISOString()).lt('created_at', period.end.toISOString())
    .order('id').range(o, o + 499));
  assert.ok(scoped.every(s => s.store_id === store.id));
  const items = await readAll<FranchiseSaleItem>(o => db.from('pos_sale_items')
    .select('sale_id,product_name_snapshot,category_snapshot,subcategory_snapshot,quantity,unit_price,line_total,pos_sales!inner(store_id,status,created_at)')
    .eq('pos_sales.store_id', store.id).eq('pos_sales.status', 'completed')
    .gte('pos_sales.created_at', period.start.toISOString()).lt('pos_sales.created_at', period.end.toISOString())
    .order('id').range(o, o + 499));
  const cents = scoped.reduce((n, s) => n + Math.round(Number(s.total) * 100), 0);
  const itemCents = items.reduce((n, i) => n + Math.round(Number(i.line_total) * 100), 0);
  assert.equal(cents, itemCents);
  assert.ok(items.every(i => Math.round(Number(i.line_total) * 100) === Math.round(Number(i.unit_price) * 100) * Number(i.quantity)));
  const categories = summarizeSaleItems(items).categories;
  assert.equal(categories.length, 7);
  const monthly = summarizeFranchiseSales(scoped, reportPeriod({ from: '2026-09-01', to: '2026-09-30' }, anchor), anchor);
  assert.ok(monthly.selected.length > 0 && monthly.selected.length < scoped.length);
  const { count, error: customerError } = await db.from('pos_customers').select('id', { head: true, count: 'exact' })
    .eq('store_id', store.id).is('deleted_at', null);
  assert.equal(customerError, null);
  storeCents += cents;
  result.push({ store: store.name, transactions: scoped.length, revenue: cents / 100, customers: count, september: monthly.revenue });
}
assert.equal(storeCents, Math.round(summary.revenue * 100));
console.log(JSON.stringify({ project, franchise, period: [period.from, period.to], stores: result,
  transactions: sales.length, revenue: summary.revenue, month: summary.month, week: summary.week,
  verified: ['dashboard REST queries', 'pagination beyond 1000 records', 'existing reporting functions', 'store isolation', 'line reconciliation', 'category totals', 'date filtering'] }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
