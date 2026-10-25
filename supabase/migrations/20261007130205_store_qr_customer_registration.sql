begin;

-- Only the trusted server can resolve/provision tokens or complete verification.
create table if not exists public.store_registration_tokens (
  store_id uuid primary key references public.stores(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex') check (token ~ '^[a-f0-9]{64}$'),
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
insert into public.store_registration_tokens(store_id) select id from public.stores on conflict (store_id) do nothing;
alter table public.store_registration_tokens enable row level security;
revoke all on public.store_registration_tokens from public, anon, authenticated;
grant all on public.store_registration_tokens to service_role;

-- Keep evidence separate from the staff-readable POS customer table.
create table public.qr_customer_registrations (
  id uuid primary key,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  customer_id uuid not null unique references public.pos_customers(id),
  store_id uuid not null references public.stores(id),
  email text not null,
  source text not null default 'store_qr' check (source = 'store_qr'),
  document_type text not null check (document_type in ('sa_id', 'passport')),
  document_fingerprint text not null check (document_fingerprint ~ '^[a-f0-9]{64}$'),
  document_last_four text not null check (char_length(document_last_four) = 4),
  number_matched boolean not null check (number_matched),
  age_confirmed boolean not null check (age_confirmed),
  verified_at timestamptz not null default now(),
  terms_version text not null,
  privacy_version text not null,
  verification_notice_version text not null,
  acknowledged_at timestamptz not null default now(),
  affirmative_action text not null default 'Register Customer',
  marketing boolean not null,
  marketing_channels text[] not null default '{}',
  check (marketing_channels <@ array['email','sms','whatsapp']::text[]),
  check ((marketing and cardinality(marketing_channels) > 0) or (not marketing and cardinality(marketing_channels) = 0))
);
alter table public.qr_customer_registrations enable row level security;
revoke all on public.qr_customer_registrations from public, anon, authenticated;
grant all on public.qr_customer_registrations to service_role;
create index qr_customer_registrations_store_idx on public.qr_customer_registrations(store_id);

create table public.qr_document_cleanup (
  path text primary key,
  created_at timestamptz not null default now()
);
alter table public.qr_document_cleanup enable row level security;
revoke all on public.qr_document_cleanup from public, anon, authenticated;
grant all on public.qr_document_cleanup to service_role;
create index qr_document_cleanup_created_idx on public.qr_document_cleanup(created_at);

create table public.qr_registration_audits (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  store_id uuid not null references public.stores(id),
  event text not null check (event in ('document_check_requested', 'document_deleted', 'document_delete_retry')),
  purpose text not null default 'store_customer_registration',
  created_at timestamptz not null default now()
);
alter table public.qr_registration_audits enable row level security;
revoke all on public.qr_registration_audits from public, anon, authenticated;
grant all on public.qr_registration_audits to service_role;
create index qr_registration_audits_store_created_idx on public.qr_registration_audits(store_id, created_at);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('registration-documents', 'registration-documents', false, 6291456, array['image/jpeg'])
on conflict(id) do update set public = false, file_size_limit = 6291456, allowed_mime_types = array['image/jpeg'];
-- Restrictive policy also fences this bucket off from any broad existing storage policies.
create policy registration_documents_no_browser_access on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'registration-documents') with check (bucket_id <> 'registration-documents');

create function public.complete_qr_customer_registration(
  p_token text, p_submission_id uuid, p_payload_hash text,
  p_full_name text, p_email text, p_phone_normalized text, p_phone_digits text, p_phone_display text,
  p_document_type text, p_document_fingerprint text, p_document_last_four text,
  p_number_matched boolean, p_age_confirmed boolean,
  p_accept_terms boolean, p_accept_privacy boolean, p_accept_verification boolean,
  p_notice_version text, p_marketing boolean, p_channels text[]
)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  resolved_store uuid;
  existing public.qr_customer_registrations%rowtype;
  customer uuid;
  names text[];
begin
  select s.id into resolved_store from public.store_registration_tokens t
  join public.stores s on s.id = t.store_id
  where t.token = p_token and t.revoked_at is null
    and (t.expires_at is null or t.expires_at > now())
    and s.is_active and coalesce(s.store_access_status, 'active') = 'active'
  for share of t, s;
  if resolved_store is null then raise exception using errcode = '22023', message = 'Registration link unavailable.'; end if;

  if p_submission_id is null or p_number_matched is distinct from true or p_age_confirmed is distinct from true
    or p_accept_terms is distinct from true or p_accept_privacy is distinct from true or p_accept_verification is distinct from true
    or p_notice_version is distinct from '2026-10-07'
    or char_length(btrim(p_full_name)) not between 2 and 160
    or p_document_type not in ('sa_id','passport')
    or p_phone_normalized is distinct from ('+27' || substring(p_phone_digits from 2))
  then raise exception using errcode = '22023', message = 'Registration requirements incomplete.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text, 0));
  select * into existing from public.qr_customer_registrations where id = p_submission_id;
  if found then
    if existing.store_id is distinct from resolved_store or existing.payload_hash is distinct from p_payload_hash then
      raise exception using errcode = '22023', message = 'Registration request changed.';
    end if;
    return existing.customer_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(resolved_store::text || p_phone_normalized, 0));
  -- No public merge, revival or disclosure of an existing profile, including deleted profiles.
  if exists(select 1 from public.pos_customers where store_id = resolved_store and phone_normalized = p_phone_normalized) then
    raise exception using errcode = '23505', message = 'Please ask the store for registration assistance.';
  end if;
  names := regexp_split_to_array(btrim(p_full_name), '\s+');
  insert into public.pos_customers(store_id, first_name, surname, full_name, phone_normalized, phone_digits, phone_display)
  values (resolved_store, names[1], case when cardinality(names) = 1 then names[1] else array_to_string(names[2:cardinality(names)], ' ') end,
    btrim(p_full_name), p_phone_normalized, p_phone_digits, p_phone_display) returning id into customer;
  insert into public.qr_customer_registrations(id, payload_hash, customer_id, store_id, email,
    document_type, document_fingerprint, document_last_four, number_matched, age_confirmed,
    terms_version, privacy_version, verification_notice_version, marketing, marketing_channels)
  values (p_submission_id, p_payload_hash, customer, resolved_store, p_email, p_document_type,
    p_document_fingerprint, p_document_last_four, true, true,
    p_notice_version, p_notice_version, p_notice_version, p_marketing, case when p_marketing then p_channels else '{}'::text[] end);
  return customer;
end;
$$;
revoke all on function public.complete_qr_customer_registration(text,uuid,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean,text,boolean,text[]) from public, anon, authenticated;
grant execute on function public.complete_qr_customer_registration(text,uuid,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean,text,boolean,text[]) to service_role;

-- Defense in depth for every POS sale insertion/update, including privileged callers.
create function public.enforce_pos_sale_customer_store() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.customer_id is not null and not exists (
    select 1 from public.pos_customers where id = new.customer_id and store_id = new.store_id and deleted_at is null
  ) then raise exception using errcode = '42501', message = 'Customer does not belong to this store.'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_pos_sale_customer_store() from public, anon, authenticated;
create trigger pos_sale_customer_store_guard before insert or update of customer_id, store_id
on public.pos_sales for each row execute function public.enforce_pos_sale_customer_store();
commit;
