alter table public.audit_events
  add column if not exists interaction_id uuid,
  add column if not exists result text not null default 'success' check (result in ('success','denied','validation_error','failure')),
  add column if not exists metadata_json jsonb not null default '{}';

alter table public.audit_events
  add constraint audit_events_metadata_object check (jsonb_typeof(metadata_json) = 'object');

create or replace function public.audit_events_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit events are immutable';
end;
$$;

drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update
before update or delete on public.audit_events
for each row execute function public.audit_events_immutable();

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('dry_run','commit')),
  status text not null check (status in ('pending','validated','validation_failed','committed','failed')),
  row_count int not null default 0 check (row_count >= 0 and row_count <= 500),
  valid_row_count int not null default 0 check (valid_row_count >= 0),
  error_count int not null default 0 check (error_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_job_errors (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_number int not null check (row_number > 0),
  field_path text,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  cart_id uuid not null references public.carts(id) on delete restrict,
  created_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','confirmed','cancelled','completed')),
  total_cents int not null default 0 check (total_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, cart_id)
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created','confirmed','cancelled','completed')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

alter table public.import_jobs enable row level security;
alter table public.import_job_errors enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;

create policy import_jobs_staff_read on public.import_jobs for select using (public.is_store_member(store_id));
create policy import_jobs_admin_write on public.import_jobs for insert with check (public.has_store_role(store_id, array['admin','catalog_manager']));
create policy import_errors_staff_read on public.import_job_errors for select using (
  exists(select 1 from public.import_jobs j where j.id = import_job_id and public.is_store_member(j.store_id))
);
create policy import_errors_admin_write on public.import_job_errors for insert with check (
  exists(select 1 from public.import_jobs j where j.id = import_job_id and public.has_store_role(j.store_id, array['admin','catalog_manager']))
);

create policy orders_member_read on public.orders for select using (public.is_store_member(store_id));
create policy orders_member_insert on public.orders for insert with check (public.is_store_member(store_id));
create policy orders_admin_update on public.orders for update using (public.has_store_role(store_id, array['admin','receptionist'])) with check (public.has_store_role(store_id, array['admin','receptionist']));
create policy order_events_member_read on public.order_events for select using (public.is_store_member(store_id));
create policy order_events_member_insert on public.order_events for insert with check (public.is_store_member(store_id));
