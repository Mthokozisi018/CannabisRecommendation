import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
it('corrects the manager daily SQL aggregate while retaining tenant and role checks',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated;
   create table public.pos_sales(store_id uuid,status text,total numeric(12,2),refunded_amount numeric(12,2),created_at timestamptz);
   create function public.current_staff_store_id() returns uuid language sql as $$ select nullif(current_setting('test.store',true),'')::uuid $$;
   create function public.is_greenchoice_manager() returns boolean language sql as $$ select coalesce(current_setting('test.manager',true),'false')::boolean $$;
   select set_config('test.store','10000000-0000-4000-8000-000000000001',false); select set_config('test.manager','true',false);
   insert into pos_sales select '10000000-0000-4000-8000-000000000001','completed',total,refund,statement_timestamp() from (values(370,0),(150,150),(250,0),(100,100),(80,30)) v(total,refund);
   insert into pos_sales values ('10000000-0000-4000-8000-000000000002','completed',99999,0,statement_timestamp()),('10000000-0000-4000-8000-000000000001','cancelled',99999,0,statement_timestamp());`);
  await db.exec(readFileSync('supabase/migrations/20261017093549_manager_net_revenue.sql','utf8'));
  await db.exec('set role authenticated');
  const result=await db.query<{total_sales:string}>('select * from public.get_manager_sales_total_today()');
  expect(Number(result.rows[0].total_sales)).toBe(670);
  await db.exec("select set_config('test.manager','false',false)");
  await expect(db.query('select * from public.get_manager_sales_total_today()')).rejects.toThrow('not_authorized');
 } finally {await db.close();}
});
