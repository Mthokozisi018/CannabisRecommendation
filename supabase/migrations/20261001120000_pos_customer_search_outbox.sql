-- Local/staging only. Apply before reindexing; do not apply to production yet.
begin;
set local search_path = public, pg_catalog;

create table if not exists public.pos_customer_search_outbox (
  customer_id uuid primary key,
  changed_at timestamptz not null default clock_timestamp()
);

revoke all on public.pos_customer_search_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.pos_customer_search_outbox to service_role;
alter table public.pos_customer_search_outbox enable row level security;

create or replace function public.queue_pos_customer_search_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare changed_id uuid;
begin
  if tg_op = 'DELETE' then
    changed_id := old.id;
  else
    changed_id := new.id;
  end if;
  insert into public.pos_customer_search_outbox(customer_id, changed_at)
  values (changed_id, clock_timestamp())
  on conflict (customer_id) do update set changed_at = excluded.changed_at;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.queue_pos_customer_search_change() from public, anon, authenticated;
drop trigger if exists pos_customer_search_changed on public.pos_customers;
create trigger pos_customer_search_changed
after insert or update or delete on public.pos_customers
for each row execute function public.queue_pos_customer_search_change();

-- Queue preexisting records too; the worker uses the customer ID as the document ID.
insert into public.pos_customer_search_outbox(customer_id)
select id from public.pos_customers
on conflict (customer_id) do nothing;

commit;
