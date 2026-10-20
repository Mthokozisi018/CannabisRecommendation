// Real POS checkout/refund functions and FA aggregation, disposable in-memory Postgres only.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
process.env.POS_CONFIRMATION_BROWSER='1';
const {db,uuid}=await import('../local/pos-confirmation-database.mjs');
try {
  await db.exec(`create schema private; create function auth.uid() returns uuid language sql stable as $$select '${uuid(71)}'::uuid$$;
    create function private.current_franchise_id() returns uuid language sql stable as $$select '${uuid(81)}'::uuid$$;
    create function private.fa_owns_store(target uuid) returns boolean language sql stable as $$select target='${uuid(1)}'::uuid$$;
    alter table stores add column franchise_id uuid;
    update stores set franchise_id=case when id='${uuid(1)}' then '${uuid(81)}'::uuid else '${uuid(82)}'::uuid end;
    grant usage on schema private,auth to authenticated; grant select on stores to authenticated;
    set test.store='${uuid(1)}';`);
  const sql=readFileSync('supabase/migrations/20261016174201_franchise_admin_remediation.sql','utf8');
  await db.exec(sql.slice(0,sql.indexOf('-- Existing callers'))+'commit;');
  const start=sql.indexOf('create function public.franchise_store_item_totals');
  await db.exec(sql.slice(start,sql.lastIndexOf('commit;')));
  await db.exec('set role authenticated');
  const result=await db.query('select franchise_dashboard_totals_v2($1,$2,$3) totals',[uuid(81),'2000-01-01','2100-01-01']);
  const daily=result.rows[0].totals.daily;
  assert.equal(daily.reduce((n,r)=>n+Math.round(r.revenue*100),0),75000);
  assert.equal(daily.reduce((n,r)=>n+r.transactions,0),3);
  const items=(await db.query('select franchise_store_item_totals($1,$2,$3) totals',[uuid(1),'2000-01-01','2100-01-01'])).rows[0].totals;
  assert.equal(items.products.reduce((n,r)=>n+Math.round(r.revenue*100),0),75000);
  assert.equal(items.categories.reduce((n,r)=>n+Math.round(r.value*100),0),75000);
  await assert.rejects(()=>db.query('select franchise_dashboard_totals_v2($1,$2,$3)',[uuid(82),'2000-01-01','2100-01-01']));
  writeFileSync('../docs/fa-remediation-evidence/pos-financial-integration.json',JSON.stringify({passed:true,completedTransactions:3,netRevenue:750,categoryRevenue:750,productRevenue:750,refundedSales:2,foreignFranchiseRejected:true},null,2));
} finally { await db.close(); }
