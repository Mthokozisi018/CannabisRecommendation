create or replace function public.franchise_dashboard_showcase_totals(
  p_franchise_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_store_id uuid default null,
  p_customers boolean default true
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $function$
declare
  result jsonb;
begin
  if auth.uid() is null
    or auth.jwt()->'app_metadata'->>'greenchoice_demo_mode' is distinct from 'historical'
    or auth.jwt()->'app_metadata'->>'greenchoice_franchise_id' is distinct from p_franchise_id::text
    or private.current_franchise_id() is distinct from p_franchise_id
    or p_start is null or p_end is null or p_end <= p_start
    or p_end - p_start > interval '370 days'
  then
    raise exception 'Showcase report access denied' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'store_id', day_totals.store_id,
        'day', day_totals.day,
        'revenue', day_totals.revenue,
        'transactions', day_totals.transactions
      ) order by day_totals.day,day_totals.store_id)
      from (
        select ps.store_id,
          (ps.created_at at time zone 'Africa/Johannesburg')::date as day,
          round(sum(greatest(0,ps.total-ps.refunded_amount)),2) as revenue,
          count(*)::int as transactions
        from public.pos_sales ps
        join public.stores s on s.id=ps.store_id
        where s.franchise_id=p_franchise_id
          and (p_store_id is null or ps.store_id=p_store_id)
          and ps.status='voided'
          and ps.payment_provider='greenchoice_demo'
          and ps.created_at>=p_start and ps.created_at<p_end
        group by ps.store_id,(ps.created_at at time zone 'Africa/Johannesburg')::date
      ) day_totals
    ),'[]'::jsonb),
    'customers',coalesce((
      select jsonb_agg(jsonb_build_object('store_id',counts.store_id,'count',counts.customer_count)
        order by counts.store_id)
      from (
        select c.store_id,count(*)::int as customer_count
        from public.pos_customers c join public.stores s on s.id=c.store_id
        where p_customers and s.franchise_id=p_franchise_id
          and (p_store_id is null or c.store_id=p_store_id)
          and c.deleted_at is null
        group by c.store_id
      ) counts
    ),'[]'::jsonb)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.franchise_dashboard_showcase_totals(uuid,timestamptz,timestamptz,uuid,boolean)
  from public,anon;
grant execute on function public.franchise_dashboard_showcase_totals(uuid,timestamptz,timestamptz,uuid,boolean)
  to authenticated;
