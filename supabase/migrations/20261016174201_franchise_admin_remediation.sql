begin;

-- Compact dashboard totals. SECURITY INVOKER keeps every existing RLS policy
-- effective; the explicit identity check also rejects forged franchise IDs.
create or replace function public.franchise_dashboard_totals_v2(
  p_franchise_id uuid, p_start timestamptz, p_end timestamptz,
  p_store_id uuid default null, p_customers boolean default true
) returns jsonb language plpgsql stable security invoker
set search_path = pg_catalog, public as $$
declare result jsonb;
begin
  if auth.uid() is null or p_franchise_id is distinct from private.current_franchise_id() then
    raise exception 'Franchise access denied' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid reporting bounds';
  end if;
  if p_store_id is not null and not exists (
    select 1 from public.stores where id=p_store_id and franchise_id=p_franchise_id
  ) then raise exception 'Store access denied' using errcode = '42501'; end if;
  with scoped_stores as materialized (
    select id from public.stores where franchise_id=p_franchise_id
      and (p_store_id is null or id=p_store_id)
  ), daily as (
    select s.store_id, (s.created_at at time zone 'Africa/Johannesburg')::date as day,
      sum(round((s.total-coalesce(s.refunded_amount,0))*100))/100 as revenue, count(*) as transactions
    from public.pos_sales s join scoped_stores st on st.id=s.store_id
    where s.status='completed' and s.created_at>=p_start and s.created_at<p_end
    group by s.store_id, (s.created_at at time zone 'Africa/Johannesburg')::date
  ), customers as (
    select c.store_id, count(*) as count from public.pos_customers c
    join scoped_stores st on st.id=c.store_id
    where p_customers and c.deleted_at is null group by c.store_id
  )
  select jsonb_build_object(
    'daily', coalesce((select jsonb_agg(to_jsonb(d) order by day,store_id) from daily d),'[]'::jsonb),
    'customers', coalesce((select jsonb_agg(to_jsonb(c)) from customers c),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.franchise_dashboard_totals_v2(uuid,timestamptz,timestamptz,uuid,boolean) from public,anon;
grant execute on function public.franchise_dashboard_totals_v2(uuid,timestamptz,timestamptz,uuid,boolean) to authenticated;

-- Existing callers also receive corrected totals once this forward migration is approved.
create or replace function public.franchise_dashboard_totals(p_franchise_id uuid,p_start timestamptz,p_end timestamptz,p_store_id uuid default null,p_customers boolean default true)
returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select public.franchise_dashboard_totals_v2(p_franchise_id,p_start,p_end,p_store_id,p_customers);
$$;
revoke all on function public.franchise_dashboard_totals(uuid,timestamptz,timestamptz,uuid,boolean) from public,anon;
grant execute on function public.franchise_dashboard_totals(uuid,timestamptz,timestamptz,uuid,boolean) to authenticated;

-- A request and its result commit atomically. No browser role can read or write this ledger.
create table private.franchise_store_requests (
 actor_id uuid not null references auth.users(id) on delete cascade,
 franchise_id uuid not null references public.franchises(id) on delete cascade,
 request_key uuid not null,
 payload jsonb not null,
 store_id uuid not null references public.stores(id) on delete cascade,
 primary key(actor_id,franchise_id,request_key)
);
alter table private.franchise_store_requests enable row level security;
revoke all on private.franchise_store_requests from public,anon,authenticated,service_role;
alter function private.franchise_mutation(uuid,text,jsonb) rename to franchise_mutation_unkeyed;
revoke all on function private.franchise_mutation_unkeyed(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function private.franchise_mutation(p_actor uuid,p_action text,p_data jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.staff_profiles%rowtype; saved private.franchise_store_requests%rowtype;
 request_id uuid; canonical jsonb; result_id uuid;
begin
 if p_action is distinct from 'create_store' then
   return private.franchise_mutation_unkeyed(p_actor,p_action,p_data);
 end if;
 -- Recheck authorization even for a replay after account restriction/reassignment.
 select * into actor from public.staff_profiles where auth_user_id=p_actor for update;
 if actor.id is null or actor.role is distinct from 'franchise_admin' or actor.franchise_id is null
   or actor.account_status is distinct from 'active' or actor.is_active is not true or actor.account_setup_complete is not true
   or actor.temporary_password_active is distinct from false or actor.password_changed_at is null
   or actor.terms_accepted_at is null or actor.privacy_policy_accepted_at is null then
   raise exception 'Access denied' using errcode='42501';
 end if;
 request_id := (p_data->>'idempotencyKey')::uuid;
 if request_id is null then raise exception 'A store request key is required' using errcode='22023'; end if;
 canonical := p_data - 'idempotencyKey' - 'slug';
 -- The actor row lock serializes concurrent creations before reading the ledger.
 select * into saved from private.franchise_store_requests
 where actor_id=p_actor and franchise_id=actor.franchise_id and request_key=request_id;
 if found then
   if saved.payload is distinct from canonical then
     raise exception 'This request key was already used for different store details' using errcode='22023';
   end if;
   return saved.store_id;
 end if;
 result_id := private.franchise_mutation_unkeyed(p_actor,p_action,p_data);
 insert into private.franchise_store_requests values(p_actor,actor.franchise_id,request_id,canonical,result_id);
 return result_id;
end $$;
revoke all on function private.franchise_mutation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.franchise_mutation(uuid,text,jsonb) to service_role;
create or replace function public.franchise_mutation(p_actor uuid,p_action text,p_data jsonb)
returns uuid language sql security invoker set search_path=pg_catalog,public as $$
 select private.franchise_mutation(p_actor,p_action,p_data);
$$;
revoke all on function public.franchise_mutation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.franchise_mutation(uuid,text,jsonb) to service_role;

-- Versioned capability: new app code must not silently use an older unkeyed deployment.
create function public.franchise_mutation_v2(p_actor uuid,p_action text,p_data jsonb)
returns uuid language sql security invoker set search_path=pg_catalog,public as $$
 select private.franchise_mutation(p_actor,p_action,p_data);
$$;
revoke all on function public.franchise_mutation_v2(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.franchise_mutation_v2(uuid,text,jsonb) to service_role;

-- Aggregate in Postgres instead of downloading every historical sale/item.
-- Allocate sale net cents by recorded item weights; largest remainders preserve exact cents.
create function public.franchise_store_item_totals(p_store_id uuid,p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.fa_owns_store(p_store_id) then
   raise exception 'Store access denied' using errcode='42501';
 end if;
 if p_start is null or p_end is null or p_end<=p_start then raise exception 'Invalid reporting bounds'; end if;
 with raw as (
   select i.id,i.sale_id,coalesce(nullif(btrim(i.category_snapshot),''),'Uncategorized') category,
    coalesce(nullif(btrim(i.product_name_snapshot),''),'Historical product') name,i.quantity,
    round((s.total-coalesce(s.refunded_amount,0))*100) net_cents,
    i.line_total,sum(i.line_total) over(partition by i.sale_id) weight
   from public.pos_sale_items i join public.pos_sales s on s.id=i.sale_id
   where s.store_id=p_store_id and s.status='completed' and s.created_at>=p_start and s.created_at<p_end
 ), shares as (
   select *,case when weight>0 then net_cents*line_total/weight else 0 end exact_cents from raw
 ), ranked as (
   select *,row_number() over(partition by sale_id order by exact_cents-floor(exact_cents) desc,id) rank,
    net_cents-sum(floor(exact_cents)) over(partition by sale_id) remainder from shares
 ), allocated as (
   select *,floor(exact_cents)+case when weight=0 and rank=1 then net_cents
     when weight>0 and rank<=remainder then 1 else 0 end cents from ranked
 ), categories as (select category label,sum(cents)/100 value from allocated group by category),
 products as (select jsonb_build_array(category,name)::text key,name,sum(quantity) quantity,sum(cents)/100 revenue
   from allocated group by category,name)
 select jsonb_build_object(
  'categories',coalesce((select jsonb_agg(to_jsonb(c) order by label) from categories c),'[]'::jsonb),
  'products',coalesce((select jsonb_agg(to_jsonb(p) order by revenue desc,key) from products p),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.franchise_store_item_totals(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.franchise_store_item_totals(uuid,timestamptz,timestamptz) to authenticated;
commit;
