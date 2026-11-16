begin;

-- Keep the existing manager snapshot and marker. This registry covers only the
-- existing fictional franchise; no account is selected by email at runtime.
create table private.demo_franchise_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  franchise_id uuid not null unique references public.franchises(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table private.demo_franchise_accounts enable row level security;
revoke all on private.demo_franchise_accounts from public, anon, authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from auth.users u
    join public.staff_profiles p on p.auth_user_id = u.id
    join public.franchises f on f.id = p.franchise_id
    where u.id = 'c5ad6760-a2a0-4b0b-b3f8-d845e39b25c8'
      and lower(u.email) = 'franchise.admin@example.com'
      and p.role = 'franchise_admin' and p.account_status = 'active'
      and p.franchise_id = '6d22b8a6-adbb-444f-8c09-06d664d5c5cc'
      and f.name = 'DEMO - Fictional GreenChoice Franchise (Test Only)'
  ) or exists (
    select 1 from public.stores
    where franchise_id = '6d22b8a6-adbb-444f-8c09-06d664d5c5cc'
      and name not like 'DEMO - %'
  ) then
    raise exception 'Existing franchise demo assignment failed verification';
  end if;
end $$;

insert into private.demo_franchise_accounts(auth_user_id, franchise_id)
values ('c5ad6760-a2a0-4b0b-b3f8-d845e39b25c8',
        '6d22b8a6-adbb-444f-8c09-06d664d5c5cc');

create function private.demo_franchise_id() returns uuid language sql stable security definer
set search_path = pg_catalog, private as $$
  select franchise_id from private.demo_franchise_accounts where auth_user_id = auth.uid();
$$;
revoke all on function private.demo_franchise_id() from public;
grant execute on function private.demo_franchise_id() to authenticated;

-- No caller-controlled user ID or email. The client can discover only its own
-- account type; scope stays in the private registry.
create function public.current_demo_access() returns text language sql stable security definer
set search_path = pg_catalog, private as $$
  select case
    when exists(select 1 from private.demo_accounts where auth_user_id = auth.uid()) then 'manager'
    when exists(select 1 from private.demo_franchise_accounts where auth_user_id = auth.uid()) then 'franchise_admin'
    else null
  end;
$$;
revoke all on function public.current_demo_access() from public, anon;
grant execute on function public.current_demo_access() to authenticated;

create function private.demo_franchise_store_is_visible(target_store uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, private, public as $$
  select not exists (
    select 1 from public.stores s
    join private.demo_franchise_accounts d on d.franchise_id = s.franchise_id
    where s.id = target_store and d.auth_user_id is distinct from auth.uid()
  );
$$;
revoke all on function private.demo_franchise_store_is_visible(uuid) from public;
grant execute on function private.demo_franchise_store_is_visible(uuid) to anon, authenticated;

create policy demo_franchise_store_catalog_boundary on public.stores
as restrictive for select to anon, authenticated
using ((select private.demo_franchise_store_is_visible(id)));
create policy demo_franchise_product_catalog_boundary on public.products
as restrictive for select to anon, authenticated
using ((select private.demo_franchise_store_is_visible(store_id)));

create or replace function private.reject_demo_write() returns trigger language plpgsql security definer
set search_path = pg_catalog, private as $$
begin
  if private.demo_store_id() is not null or private.demo_franchise_id() is not null then
    raise exception 'This demo account is view only.' using errcode = '42501';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

-- Restrictive policies AND the original tenant policies must both pass.
-- Permissive snapshot policies allow only the registered fictional franchise.
do $$
declare t record; manager_scope text; franchise_scope text;
begin
  for t in select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
  loop
    if t.relname in ('categories','effects','flavors','terpenes') then
      manager_scope := 'true'; franchise_scope := 'true';
    elsif t.relname = 'stores' then
      manager_scope := 'id=(select private.demo_store_id())';
      franchise_scope := 'franchise_id=(select private.demo_franchise_id())';
    elsif t.relname = 'franchises' then
      manager_scope := 'false';
      franchise_scope := 'id=(select private.demo_franchise_id())';
    elsif t.relname = 'staff_profiles' then
      manager_scope := 'auth_user_id=(select auth.uid())';
      franchise_scope := manager_scope;
    elsif t.relname like 'billing_%' or t.relname like 'qr_%' or t.relname like 'manager_welcome_%'
      or t.relname like 'customer_%' or t.relname like 'order_%' or t.relname like 'import_%' or t.relname in
      ('audit_logs','audit_events','carts','cart_items','orders','payment_transactions',
       'recommendation_sessions','manager_invitations','franchise_invitations',
       'staff_invitations','store_memberships','store_registration_tokens','pos_customer_search_outbox') then
      manager_scope := 'false'; franchise_scope := 'false';
    elsif t.relname = 'master_supply_distribution_items' then
      manager_scope := 'false';
      franchise_scope := 'exists(select 1 from public.master_supply_distributions d where d.id=distribution_id and d.franchise_id=(select private.demo_franchise_id()))';
    elsif t.relname = 'master_supply_request_items' then
      manager_scope := 'false';
      franchise_scope := 'exists(select 1 from public.master_supply_requests r where r.id=request_id and r.franchise_id=(select private.demo_franchise_id()))';
    else
      manager_scope := 'false'; franchise_scope := 'false';
      if exists(select 1 from information_schema.columns
          where table_schema='public' and table_name=t.relname and column_name='store_id') then
        manager_scope := 'store_id=(select private.demo_store_id())';
        franchise_scope := 'exists(select 1 from public.stores ds where ds.id=store_id and ds.franchise_id=(select private.demo_franchise_id()))';
      elsif exists(select 1 from information_schema.columns
          where table_schema='public' and table_name=t.relname and column_name='franchise_id') then
        franchise_scope := 'franchise_id=(select private.demo_franchise_id())';
      elsif t.relname = 'pos_sale_items' then
        manager_scope := 'exists(select 1 from public.pos_sales ds where ds.id=sale_id and ds.store_id=(select private.demo_store_id()))';
        franchise_scope := 'exists(select 1 from public.pos_sales ds join public.stores st on st.id=ds.store_id where ds.id=sale_id and st.franchise_id=(select private.demo_franchise_id()))';
      elsif exists(select 1 from information_schema.columns
          where table_schema='public' and table_name=t.relname and column_name='product_id') then
        manager_scope := 'exists(select 1 from public.products dp where dp.id=product_id and dp.store_id=(select private.demo_store_id()))';
        franchise_scope := 'exists(select 1 from public.products dp join public.stores st on st.id=dp.store_id where dp.id=product_id and st.franchise_id=(select private.demo_franchise_id()))';
      end if;
    end if;

    if not t.relrowsecurity then
      execute format('alter table public.%I enable row level security',t.relname);
      execute format('create policy demo_preserve_normal_access on public.%I for all using ((select private.demo_store_id()) is null and (select private.demo_franchise_id()) is null) with check ((select private.demo_store_id()) is null and (select private.demo_franchise_id()) is null)',t.relname);
    end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t.relname and policyname='demo_read_boundary') then
      execute format('create policy demo_snapshot_read on public.%I for select to authenticated using (%s)',t.relname,manager_scope);
      execute format('create policy demo_read_boundary on public.%I as restrictive for select to authenticated using ((select private.demo_store_id()) is null or (%s))',t.relname,manager_scope);
      execute format('create policy demo_no_insert on public.%I as restrictive for insert to authenticated with check ((select private.demo_store_id()) is null)',t.relname);
      execute format('create policy demo_no_update on public.%I as restrictive for update to authenticated using ((select private.demo_store_id()) is null) with check ((select private.demo_store_id()) is null)',t.relname);
      execute format('create policy demo_no_delete on public.%I as restrictive for delete to authenticated using ((select private.demo_store_id()) is null)',t.relname);
    end if;
    execute format('create policy demo_franchise_snapshot_read on public.%I for select to authenticated using (%s)',t.relname,franchise_scope);
    execute format('create policy demo_franchise_read_boundary on public.%I as restrictive for select to authenticated using ((select private.demo_franchise_id()) is null or (%s))',t.relname,franchise_scope);
    execute format('create policy demo_franchise_no_insert on public.%I as restrictive for insert to authenticated with check ((select private.demo_franchise_id()) is null)',t.relname);
    execute format('create policy demo_franchise_no_update on public.%I as restrictive for update to authenticated using ((select private.demo_franchise_id()) is null) with check ((select private.demo_franchise_id()) is null)',t.relname);
    execute format('create policy demo_franchise_no_delete on public.%I as restrictive for delete to authenticated using ((select private.demo_franchise_id()) is null)',t.relname);
    if not exists(select 1 from pg_trigger g join pg_class c on c.oid=g.tgrelid
        where c.relname=t.relname and g.tgname='demo_reject_write' and not g.tgisinternal) then
      execute format('create trigger demo_reject_write before insert or update or delete on public.%I for each row execute function private.reject_demo_write()',t.relname);
      execute format('create trigger demo_reject_truncate before truncate on public.%I for each statement execute function private.reject_demo_write()',t.relname);
    end if;
  end loop;
end $$;

create policy demo_franchise_storage_read_boundary on storage.objects
as restrictive for select to authenticated
using ((select private.demo_franchise_id()) is null or
  (bucket_id='product-images' and name like 'stores/%/products/%' and
    exists(select 1 from public.stores s where s.franchise_id=(select private.demo_franchise_id())
      and storage.objects.name like ('stores/' || s.id::text || '/products/%'))));
create policy demo_franchise_storage_no_insert on storage.objects as restrictive for insert to authenticated
with check ((select private.demo_franchise_id()) is null);
create policy demo_franchise_storage_no_update on storage.objects as restrictive for update to authenticated
using ((select private.demo_franchise_id()) is null) with check ((select private.demo_franchise_id()) is null);
create policy demo_franchise_storage_no_delete on storage.objects as restrictive for delete to authenticated
using ((select private.demo_franchise_id()) is null);

create or replace function private.protect_demo_identity() returns trigger language plpgsql security definer
set search_path=pg_catalog,private as $$
begin
  if exists(select 1 from private.demo_accounts where auth_user_id=OLD.id)
      or exists(select 1 from private.demo_franchise_accounts where auth_user_id=OLD.id) then
    if TG_OP='DELETE' then raise exception 'Demo credentials are administrator-managed.' using errcode='42501'; end if;
    if NEW.email is distinct from OLD.email or NEW.encrypted_password is distinct from OLD.encrypted_password
      or NEW.phone is distinct from OLD.phone or NEW.email_change is distinct from OLD.email_change
      or NEW.phone_change is distinct from OLD.phone_change
      or NEW.raw_app_meta_data is distinct from OLD.raw_app_meta_data
      or NEW.raw_user_meta_data is distinct from OLD.raw_user_meta_data then
      raise exception 'Demo credentials are administrator-managed.' using errcode='42501';
    end if;
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;

create or replace function private.protect_demo_auth_factor() returns trigger language plpgsql security definer
set search_path=pg_catalog,private as $$
declare identity_id uuid;
begin
  if TG_OP='DELETE' then identity_id:=OLD.user_id; else identity_id:=NEW.user_id; end if;
  if exists(select 1 from private.demo_accounts where auth_user_id=identity_id)
      or exists(select 1 from private.demo_franchise_accounts where auth_user_id=identity_id) then
    if TG_TABLE_NAME='identities' and TG_OP='UPDATE' then
      if (to_jsonb(NEW)-'last_sign_in_at'-'updated_at') = (to_jsonb(OLD)-'last_sign_in_at'-'updated_at') then return NEW; end if;
    end if;
    raise exception 'Demo credentials are administrator-managed.' using errcode='42501';
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;

-- Existing QR links must not let a visitor create staff against either demo store.
update public.store_registration_tokens set revoked_at = now()
where store_id in (
  select store_id from private.demo_accounts
  union
  select s.id from public.stores s join private.demo_franchise_accounts d on d.franchise_id=s.franchise_id
);
create function private.protect_demo_registration_token() returns trigger language plpgsql security definer
set search_path=pg_catalog,private,public as $$
begin
  if exists(select 1 from private.demo_accounts where store_id=NEW.store_id)
      or exists(select 1 from public.stores s join private.demo_franchise_accounts d on d.franchise_id=s.franchise_id where s.id=NEW.store_id) then
    raise exception 'Demo stores cannot issue registration links.' using errcode='42501';
  end if;
  return NEW;
end $$;
revoke all on function private.protect_demo_registration_token() from public,anon,authenticated;
create trigger protect_demo_registration_token before insert or update of store_id, revoked_at, expires_at, token
on public.store_registration_tokens for each row execute function private.protect_demo_registration_token();

commit;
