begin;

-- Check the active franchise administrator once, then aggregate only rows
-- belonging to that franchise. This avoids evaluating sale/customer RLS for
-- every row in a large report. Keep the privileged implementation private.
create function private.franchise_dashboard_totals_fast(
  p_franchise_id uuid, p_start timestamptz, p_end timestamptz,
  p_store_id uuid, p_customers boolean
) returns jsonb language plpgsql stable security definer
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
    select 1 from public.stores where id = p_store_id and franchise_id = p_franchise_id
  ) then
    raise exception 'Store access denied' using errcode = '42501';
  end if;

  with scoped_stores as materialized (
    select id from public.stores
    where franchise_id = p_franchise_id and (p_store_id is null or id = p_store_id)
  ), daily as (
    select s.store_id, (s.created_at at time zone 'Africa/Johannesburg')::date as day,
      sum(round((s.total - coalesce(s.refunded_amount, 0)) * 100)) / 100 as revenue,
      count(*) as transactions
    from scoped_stores st join public.pos_sales s on s.store_id = st.id
    where s.status = 'completed' and s.created_at >= p_start and s.created_at < p_end
    group by s.store_id, (s.created_at at time zone 'Africa/Johannesburg')::date
  ), customers as (
    select c.store_id, count(*) as count
    from scoped_stores st join public.pos_customers c on c.store_id = st.id
    where p_customers and c.deleted_at is null
    group by c.store_id
  )
  select jsonb_build_object(
    'daily', coalesce((select jsonb_agg(to_jsonb(d) order by day, store_id) from daily d), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(to_jsonb(c) order by store_id) from customers c), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function private.franchise_dashboard_totals_fast(uuid,timestamptz,timestamptz,uuid,boolean) from public, anon;
grant execute on function private.franchise_dashboard_totals_fast(uuid,timestamptz,timestamptz,uuid,boolean) to authenticated;

-- The Data API sees only this invoker wrapper; the privileged query stays in
-- the non-exposed private schema and performs its own identity/tenant check.
create function public.franchise_dashboard_totals_v3(
  p_franchise_id uuid, p_start timestamptz, p_end timestamptz,
  p_store_id uuid default null, p_customers boolean default true
) returns jsonb language sql stable security invoker
set search_path = pg_catalog, public as $$
  select private.franchise_dashboard_totals_fast(p_franchise_id,p_start,p_end,p_store_id,p_customers);
$$;
revoke all on function public.franchise_dashboard_totals_v3(uuid,timestamptz,timestamptz,uuid,boolean) from public, anon;
grant execute on function public.franchise_dashboard_totals_v3(uuid,timestamptz,timestamptz,uuid,boolean) to authenticated;

commit;
