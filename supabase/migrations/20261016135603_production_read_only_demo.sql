begin;
create schema if not exists private;
create table private.demo_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  store_id uuid not null unique references public.stores(id) on delete restrict,
  source_store_id uuid not null references public.stores(id) on delete restrict,
  created_at timestamptz not null default now(),
  snapshot_summary jsonb not null default '{}'::jsonb
);
alter table private.demo_accounts enable row level security;
revoke all on private.demo_accounts from public,anon,authenticated,service_role;

create function private.demo_store_id() returns uuid language sql stable security definer
set search_path=pg_catalog,private as $$
  select store_id from private.demo_accounts where auth_user_id=auth.uid();
$$;
revoke all on function private.demo_store_id() from public;
grant usage on schema private to anon,authenticated,service_role;
grant execute on function private.demo_store_id() to anon,authenticated,service_role;

-- Keep the new snapshot out of ordinary customer store/product catalogues.
-- No existing store is affected. The demo's own session can see its snapshot.
create function private.demo_store_is_visible(target_store uuid) returns boolean language sql stable security definer
set search_path=pg_catalog,private as $$
  select not exists(select 1 from private.demo_accounts where store_id=target_store and auth_user_id is distinct from auth.uid());
$$;
revoke all on function private.demo_store_is_visible(uuid) from public;
grant execute on function private.demo_store_is_visible(uuid) to anon,authenticated,service_role;

create function private.reject_demo_write() returns trigger language plpgsql security definer
set search_path=pg_catalog,private as $$
begin
  if private.demo_store_id() is not null then
    raise exception 'This demo account is view only.' using errcode='42501';
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;
revoke all on function private.reject_demo_write() from public,anon,authenticated;

-- Restrictive policies only constrain the registered demo identity. Existing
-- permissive policies and normal staff/customer permissions remain authoritative.
do $$
declare t record; scope text;
begin
  for t in select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
  loop
    if t.relname in ('categories','effects','flavors','terpenes') then scope := 'true';
    elsif t.relname='stores' then scope := 'id=(select private.demo_store_id())';
    elsif t.relname='staff_profiles' then scope := 'auth_user_id=(select auth.uid())';
    elsif exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.relname and column_name='store_id') then
      scope := 'store_id=(select private.demo_store_id())';
    elsif t.relname='pos_sale_items' then
      scope := 'exists(select 1 from public.pos_sales s where s.id=sale_id and s.store_id=(select private.demo_store_id()))';
    elsif exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.relname and column_name='product_id') then
      scope := 'exists(select 1 from public.products p where p.id=product_id and p.store_id=(select private.demo_store_id()))';
    elsif exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.relname and column_name='order_id') then
      scope := 'exists(select 1 from public.orders o where o.id=order_id and o.store_id=(select private.demo_store_id()))';
    else scope := 'false'; end if;

    if not t.relrowsecurity then
      -- Preserve the pre-existing grant-only access of tables without RLS.
      execute format('alter table public.%I enable row level security',t.relname);
      execute format('create policy demo_preserve_normal_access on public.%I for all using ((select private.demo_store_id()) is null) with check ((select private.demo_store_id()) is null)',t.relname);
      execute format('create policy demo_snapshot_read on public.%I for select to authenticated using (%s)',t.relname,scope);
    end if;
    execute format('create policy demo_read_boundary on public.%I as restrictive for select to authenticated using ((select private.demo_store_id()) is null or (%s))',t.relname,scope);
    execute format('create policy demo_no_insert on public.%I as restrictive for insert to authenticated with check ((select private.demo_store_id()) is null)',t.relname);
    execute format('create policy demo_no_update on public.%I as restrictive for update to authenticated using ((select private.demo_store_id()) is null) with check ((select private.demo_store_id()) is null)',t.relname);
    execute format('create policy demo_no_delete on public.%I as restrictive for delete to authenticated using ((select private.demo_store_id()) is null)',t.relname);
    -- Also protects writes inside SECURITY DEFINER RPCs that bypass RLS.
    execute format('create trigger demo_reject_write before insert or update or delete on public.%I for each row execute function private.reject_demo_write()',t.relname);
    execute format('create trigger demo_reject_truncate before truncate on public.%I for each statement execute function private.reject_demo_write()',t.relname);
  end loop;
end $$;

create policy demo_store_catalog_boundary on public.stores as restrictive for select to anon,authenticated
using ((select private.demo_store_is_visible(id)));
create policy demo_product_catalog_boundary on public.products as restrictive for select to anon,authenticated
using ((select private.demo_store_is_visible(store_id)));

create policy demo_storage_read_boundary on storage.objects as restrictive for select to authenticated
using ((select private.demo_store_id()) is null or (bucket_id='product-images' and name like ((select private.demo_store_id())::text || '/%')));
create policy demo_storage_no_insert on storage.objects as restrictive for insert to authenticated with check ((select private.demo_store_id()) is null);
create policy demo_storage_no_update on storage.objects as restrictive for update to authenticated using ((select private.demo_store_id()) is null) with check ((select private.demo_store_id()) is null);
create policy demo_storage_no_delete on storage.objects as restrictive for delete to authenticated using ((select private.demo_store_id()) is null);

-- GoTrue's user endpoint does not use application RLS. Protect the shared
-- identity here as well, including direct password/email and metadata updates.
create function private.protect_demo_identity() returns trigger language plpgsql security definer
set search_path=pg_catalog,private as $$
begin
  if exists(select 1 from private.demo_accounts where auth_user_id=OLD.id) then
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
revoke all on function private.protect_demo_identity() from public,anon,authenticated;
create trigger protect_shared_demo_identity before update or delete on auth.users for each row execute function private.protect_demo_identity();

create function private.protect_demo_auth_factor() returns trigger language plpgsql security definer
set search_path=pg_catalog,private as $$
declare identity_id uuid;
begin
  if TG_OP='DELETE' then identity_id:=OLD.user_id; else identity_id:=NEW.user_id; end if;
  if exists(select 1 from private.demo_accounts where auth_user_id=identity_id) then
    if TG_TABLE_NAME='identities' and TG_OP='UPDATE' then
      -- GoTrue updates these timestamps during ordinary password sign-in.
      if (to_jsonb(NEW)-'last_sign_in_at'-'updated_at') = (to_jsonb(OLD)-'last_sign_in_at'-'updated_at') then return NEW; end if;
    end if;
    raise exception 'Demo credentials are administrator-managed.' using errcode='42501';
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;
revoke all on function private.protect_demo_auth_factor() from public,anon,authenticated;
create trigger protect_shared_demo_mfa before insert or update or delete on auth.mfa_factors for each row execute function private.protect_demo_auth_factor();
create trigger protect_shared_demo_identity_provider before insert or update or delete on auth.identities for each row execute function private.protect_demo_auth_factor();
commit;
