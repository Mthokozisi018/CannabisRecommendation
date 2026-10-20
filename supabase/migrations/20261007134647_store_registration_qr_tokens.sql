begin;
set local search_path = public, extensions;
-- QR provisioning is independent of customer/evidence/OCR migrations.
create table if not exists public.store_registration_tokens (
  store_id uuid primary key references public.stores(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32), 'hex') check (token ~ '^[a-f0-9]{64}$'),
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
insert into public.store_registration_tokens(store_id)
  select id from public.stores on conflict (store_id) do nothing;
alter table public.store_registration_tokens enable row level security;
revoke all on public.store_registration_tokens from public, anon, authenticated;
grant all on public.store_registration_tokens to service_role;
notify pgrst, 'reload schema';
commit;
