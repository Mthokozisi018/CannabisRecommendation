create or replace function public.get_manager_sales_total_today()
returns table(total_sales numeric)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_store_id uuid;
  v_start timestamptz;
  v_end timestamptz;
begin
  select public.current_staff_store_id() into v_store_id;
  if v_store_id is null or not public.is_greenchoice_manager() then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  v_start := date_trunc('day', statement_timestamp() at time zone 'Africa/Johannesburg')
    at time zone 'Africa/Johannesburg';
  v_end := v_start + interval '1 day';

  return query
  select coalesce(sum(ps.total), 0)::numeric
  from public.pos_sales ps
  where ps.store_id = v_store_id
    and ps.status = 'completed'
    and ps.created_at >= v_start
    and ps.created_at < v_end;
end;
$$;

alter function public.get_manager_sales_total_today() owner to postgres;
revoke all on function public.get_manager_sales_total_today() from public, anon;
grant execute on function public.get_manager_sales_total_today() to authenticated;

comment on function public.get_manager_sales_total_today() is
  'Computes the current active manager store total in the database for the Johannesburg business day.';
