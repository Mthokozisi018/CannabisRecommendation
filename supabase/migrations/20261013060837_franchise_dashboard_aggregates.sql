begin;

-- Compact dashboard totals. SECURITY INVOKER keeps every existing RLS policy
-- effective; the explicit identity check also rejects forged franchise IDs.
create or replace function public.franchise_dashboard_totals(
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
      sum(round(s.total*100))/100 as revenue, count(*) as transactions
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
revoke all on function public.franchise_dashboard_totals(uuid,timestamptz,timestamptz,uuid,boolean) from public,anon;
grant execute on function public.franchise_dashboard_totals(uuid,timestamptz,timestamptz,uuid,boolean) to authenticated;
commit;
