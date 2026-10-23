begin;

create table public.franchises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  registration_number text,
  contact_email text not null,
  phone text not null,
  address text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.franchises enable row level security;
alter table public.stores add column franchise_id uuid references public.franchises(id) on delete restrict;
alter table public.staff_profiles add column franchise_id uuid references public.franchises(id) on delete restrict;
alter table public.staff_profiles add column assigned_at timestamptz;
alter table public.staff_profiles drop constraint staff_profiles_role_check;
alter table public.staff_profiles add constraint staff_profiles_role_check check (role in ('admin','manager','receptionist','franchise_admin'));
alter table public.staff_profiles add constraint staff_profiles_franchise_assignment_check
  check ((role = 'franchise_admin' and franchise_id is not null and store_id is null) or (role <> 'franchise_admin' and franchise_id is null));
create index stores_franchise_idx on public.stores(franchise_id) where franchise_id is not null;
create index staff_profiles_franchise_idx on public.staff_profiles(franchise_id) where franchise_id is not null;
create index franchises_created_by_idx on public.franchises(created_by);
create index audit_logs_store_login_idx on public.audit_logs(store_id, created_at desc) where action = 'login_success';
create index pos_sales_store_completed_date_idx on public.pos_sales(store_id, created_at) where status = 'completed';

create schema if not exists private;
-- Read helpers deliberately bypass recursive profile/store RLS. Only these
-- narrowly scoped, authenticated predicates are executable by browser roles.
create or replace function private.is_franchise_admin() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select auth.uid() is not null and exists(select 1 from public.staff_profiles where auth_user_id=auth.uid() and role='franchise_admin');
$$;
create or replace function private.current_franchise_id() returns uuid
language sql stable security definer set search_path = pg_catalog, public as $$
  select franchise_id from public.staff_profiles
  where auth.uid() is not null and auth_user_id=auth.uid() and role='franchise_admin'
    and account_status='active' and is_active and account_setup_complete
    and temporary_password_active=false and password_changed_at is not null
    and terms_accepted_at is not null and privacy_policy_accepted_at is not null;
$$;
create or replace function private.fa_owns_store(target_store uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select auth.uid() is not null and exists(select 1 from public.stores where id=target_store and franchise_id=private.current_franchise_id());
$$;
revoke all on function private.is_franchise_admin(), private.current_franchise_id(), private.fa_owns_store(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_franchise_admin(), private.current_franchise_id(), private.fa_owns_store(uuid) to authenticated;
grant select on public.franchises to authenticated;
grant all on public.franchises to service_role;
create policy franchises_read on public.franchises for select to authenticated
  using (public.is_greenchoice_admin() or id=(select private.current_franchise_id()));

-- Restrictive policies prevent older public/catalog policies from widening FA
-- reads. Other roles continue through their existing policies.
create policy fa_stores_read on public.stores for select to authenticated using (private.fa_owns_store(id));
create policy fa_stores_boundary on public.stores as restrictive for select to authenticated
  using (not (select private.is_franchise_admin()) or private.fa_owns_store(id));
create policy fa_staff_read on public.staff_profiles for select to authenticated
  using (role in ('manager','receptionist') and private.fa_owns_store(store_id));
create policy fa_staff_boundary on public.staff_profiles as restrictive for select to authenticated
  using (not (select private.is_franchise_admin()) or auth_user_id=(select auth.uid()) or (role in ('manager','receptionist') and private.fa_owns_store(store_id)));
do $$ declare t text; begin
  foreach t in array array['products','inventory_stock','pos_sales','pos_customers','audit_logs','store_media'] loop
    execute format('create policy fa_read on public.%I for select to authenticated using (private.fa_owns_store(store_id))',t);
    execute format('create policy fa_boundary on public.%I as restrictive for select to authenticated using (not (select private.is_franchise_admin()) or private.fa_owns_store(store_id))',t);
  end loop;
end $$;
create policy fa_sale_items_read on public.pos_sale_items for select to authenticated using
  (exists(select 1 from public.pos_sales s where s.id=sale_id and private.fa_owns_store(s.store_id)));
create policy fa_sale_items_boundary on public.pos_sale_items as restrictive for select to authenticated using
  (not (select private.is_franchise_admin()) or exists(select 1 from public.pos_sales s where s.id=sale_id and private.fa_owns_store(s.store_id)));

-- Existing manager operations already use this lock. A trigger extends the
-- same limit to EVERY writer, including Admin operations and simultaneous calls.
create or replace function private.enforce_store_staff_capacity() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare occupied integer; capacity integer; begin
  if new.store_id is null or new.role not in ('manager','receptionist') then return new; end if;
  if tg_op='UPDATE' and new.store_id is not distinct from old.store_id and new.role=old.role
    and ((new.role='manager' and (new.account_status='deleted') is not distinct from (old.account_status='deleted')) or new.account_status is not distinct from old.account_status) then return new; end if;
  if new.account_status='deleted' or (new.role='receptionist' and new.account_status not in ('active','restricted')) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.store_id::text,0));
  perform 1 from public.stores where id=new.store_id for update;
  capacity := case new.role when 'manager' then 3 else 5 end;
  select count(*) into occupied from public.staff_profiles where store_id=new.store_id and role=new.role and id<>new.id
    and account_status<>'deleted' and (new.role='manager' or account_status in ('active','restricted'));
  if occupied>=capacity then raise exception '% limit reached (%)',new.role,capacity using errcode='23514'; end if;
  if tg_op='INSERT' or new.store_id is distinct from old.store_id then new.assigned_at:=statement_timestamp(); end if;
  return new;
end $$;
revoke all on function private.enforce_store_staff_capacity() from public,anon,authenticated;
create trigger enforce_store_staff_capacity before insert or update of store_id,role,account_status on public.staff_profiles
for each row execute function private.enforce_store_staff_capacity();

-- One transactional mutation boundary. Service-role only; the server supplies
-- the verified actor, and the database re-checks current assignment under lock.
create or replace function private.franchise_mutation(p_actor uuid, p_action text, p_data jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare actor public.staff_profiles%rowtype; target public.staff_profiles%rowtype;
  selected_store public.stores%rowtype; result_id uuid; target_id uuid;
  store_id_value uuid; resource text; event_details jsonb := '{}'::jsonb;
  target_user auth.users%rowtype; desired_role text;
begin
  select * into actor from public.staff_profiles where auth_user_id=p_actor for update;
  if actor.id is null or actor.account_status<>'active' or not actor.is_active then raise exception 'Access denied' using errcode='42501'; end if;
  if p_action in ('create_franchise','create_fa') then
    if actor.role<>'admin' then raise exception 'Administrator access required' using errcode='42501'; end if;
  elsif actor.role<>'franchise_admin' or actor.franchise_id is null then
    raise exception 'Franchise access denied' using errcode='42501';
  elsif p_action<>'complete_setup' and (not actor.account_setup_complete or actor.temporary_password_active or actor.password_changed_at is null
    or actor.terms_accepted_at is null or actor.privacy_policy_accepted_at is null) then
    raise exception 'Complete account setup first' using errcode='42501';
  end if;

  if p_action='create_franchise' then
    insert into public.franchises(name,registration_number,contact_email,phone,address,created_by)
    values(p_data->>'name',nullif(p_data->>'registrationNumber',''),p_data->>'email',p_data->>'phone',p_data->>'address',p_actor) returning id into result_id;
    resource:='franchises';
  elsif p_action='create_fa' then
    target_id:=(p_data->>'franchiseId')::uuid;
    perform 1 from public.franchises where id=target_id for update;
    if not found then raise exception 'Franchise not found'; end if;
    if exists(select 1 from public.staff_profiles where franchise_id=target_id and role='franchise_admin' and account_status<>'deleted') then raise exception 'This franchise already has an administrator'; end if;
    select * into target_user from auth.users where id=(p_data->>'authUserId')::uuid;
    if target_user.id is null or target_user.raw_app_meta_data->>'greenchoice_role' is distinct from 'franchise_admin'
      or target_user.raw_app_meta_data->>'greenchoice_created_by' is distinct from p_actor::text
      or target_user.raw_app_meta_data->>'greenchoice_franchise_id' is distinct from target_id::text then raise exception 'Invalid account identity'; end if;
    insert into public.staff_profiles(auth_user_id,user_id,email,full_name,first_name,surname,mobile_number,phone_number,role,franchise_id,
      created_by,account_status,is_active,account_setup_complete,profile_setup_complete,temporary_password_active)
    values(target_user.id,target_user.id,lower(target_user.email),concat(p_data->>'firstName',' ',p_data->>'surname'),p_data->>'firstName',p_data->>'surname',p_data->>'phone',p_data->>'phone',
      'franchise_admin',target_id,p_actor,'active',true,false,false,true) returning id into result_id;
    resource:='staff_profiles'; event_details:=jsonb_build_object('franchise_id',target_id);
  elsif p_action='complete_setup' then
    -- This service-only operation is called only after auth.updateUser succeeds.
    update public.staff_profiles set temporary_password_active=false,password_changed_at=now(),account_setup_complete=true,profile_setup_complete=true,
      terms_accepted=true,terms_accepted_at=now(),privacy_policy_accepted_at=now(),terms_version=p_data->>'termsVersion',privacy_policy_version=p_data->>'privacyVersion',
      onboarding_completed_at=now(),onboarding_complete_seen_at=now() where id=actor.id;
    result_id:=actor.id; resource:='staff_profiles';
  elsif p_action='create_store' then
    insert into public.stores(name,slug,franchise_id,address,store_address,physical_store_address,store_phone_number,store_contact_email,city,province,postal_code,
      is_active,store_access_status,store_information_confirmed_at,store_information_confirmed_by)
    values(p_data->>'name',p_data->>'slug',actor.franchise_id,p_data->>'address',p_data->>'address',p_data->>'address',p_data->>'phone',p_data->>'email',p_data->>'city',p_data->>'province',p_data->>'postalCode',
      true,'active',now(),p_actor) returning id into result_id;
    store_id_value:=result_id; resource:='stores';
  else
    store_id_value:=(p_data->>'storeId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended(store_id_value::text,0));
    select * into selected_store from public.stores where id=store_id_value and franchise_id=actor.franchise_id for update;
    if selected_store.id is null then raise exception 'Store access denied' using errcode='42501'; end if;
    if p_action='update_store' then
      update public.stores set name=p_data->>'name',address=p_data->>'address',store_address=p_data->>'address',physical_store_address=p_data->>'address',
        store_phone_number=p_data->>'phone',store_contact_email=nullif(p_data->>'email',''),city=p_data->>'city',province=p_data->>'province',postal_code=p_data->>'postalCode',
        opening_hours=p_data->'openingHours',is_active=(p_data->>'active')::boolean,
        store_access_status=case when (p_data->>'active')::boolean then 'active' else 'restricted' end,updated_at=now() where id=store_id_value;
      result_id:=store_id_value; resource:='stores'; event_details:=jsonb_build_object('active',p_data->'active');
    elsif p_action='store_image' then
      update public.stores set store_image_bucket='store-images',store_image_path=p_data->>'path',store_image_url=p_data->>'url',updated_at=now() where id=store_id_value;
      result_id:=store_id_value; resource:='stores';
    elsif p_action='create_staff' then
      if not selected_store.is_active or selected_store.store_access_status<>'active' then raise exception 'Activate this store before assigning staff'; end if;
      desired_role:=p_data->>'role';
      if desired_role not in ('manager','receptionist') then raise exception 'Invalid staff role'; end if;
      select * into target_user from auth.users where id=(p_data->>'authUserId')::uuid;
      if target_user.id is null or target_user.raw_app_meta_data->>'greenchoice_role' is distinct from desired_role
        or target_user.raw_app_meta_data->>'greenchoice_created_by' is distinct from p_actor::text
        or target_user.raw_app_meta_data->>'greenchoice_store_id' is distinct from store_id_value::text then raise exception 'Invalid staff identity'; end if;
      insert into public.staff_profiles(auth_user_id,user_id,email,full_name,first_name,surname,mobile_number,phone_number,role,store_id,created_by,
        account_status,is_active,account_setup_complete,profile_setup_complete,store_setup_complete,temporary_password_active)
      values(target_user.id,target_user.id,lower(target_user.email),concat(p_data->>'firstName',' ',p_data->>'surname'),p_data->>'firstName',p_data->>'surname',p_data->>'phone',p_data->>'phone',desired_role,
        store_id_value,p_actor,'active',true,false,false,true,true) returning id into result_id;
      resource:='staff_profiles'; event_details:=jsonb_build_object('role',desired_role);
    else
      select * into target from public.staff_profiles where id=(p_data->>'staffId')::uuid and store_id=store_id_value and role in ('manager','receptionist') and account_status<>'deleted' for update;
      if target.id is null then raise exception 'Staff access denied' using errcode='42501'; end if;
      result_id:=target.id; resource:='staff_profiles';
      if p_action='edit_staff' then
        update public.staff_profiles set first_name=p_data->>'firstName',surname=p_data->>'surname',full_name=concat(p_data->>'firstName',' ',p_data->>'surname'),
          mobile_number=p_data->>'phone',phone_number=p_data->>'phone' where id=target.id;
      elsif p_action in ('restrict_staff','reactivate_staff','deactivate_staff','remove_manager') then
        if p_action='remove_manager' and target.role<>'manager' then raise exception 'Manager assignment required'; end if;
        if p_action='reactivate_staff' and (not selected_store.is_active or selected_store.store_access_status<>'active') then raise exception 'Activate this store before reactivating staff'; end if;
        update public.staff_profiles set account_status=case p_action when 'restrict_staff' then 'restricted' when 'reactivate_staff' then 'active' else 'deactivated' end,
          is_active=(p_action='reactivate_staff'),store_id=case when p_action='remove_manager' then null else store_id end where id=target.id;
        -- Retire any legacy membership too; a removed account must not retain access.
        if p_action<>'reactivate_staff' then delete from public.store_memberships where user_id=target.auth_user_id and store_id=store_id_value; end if;
      elsif p_action<>'reset_staff_password' then raise exception 'Unknown franchise operation'; end if;
      event_details:=jsonb_build_object('role',target.role);
    end if;
  end if;
  insert into public.audit_logs(user_id,action,table_name,record_id,store_id,result,details)
    values(p_actor,'franchise_'||p_action,resource,result_id,store_id_value,'success',event_details||jsonb_build_object('franchise_id',coalesce(actor.franchise_id,target_id)));
  return result_id;
end $$;
revoke all on function private.franchise_mutation(uuid,text,jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.franchise_mutation(uuid,text,jsonb) to service_role;
create or replace function public.franchise_mutation(p_actor uuid,p_action text,p_data jsonb)
returns uuid language sql security invoker set search_path = pg_catalog, public as $$
  select private.franchise_mutation(p_actor,p_action,p_data);
$$;
revoke all on function public.franchise_mutation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.franchise_mutation(uuid,text,jsonb) to service_role;

-- Uploads are decoded, normalized and written by the authorized server. A
-- browser must never overwrite a cover via an older broad storage policy.
create policy store_images_server_write_only on storage.objects as restrictive for all to authenticated
  using (bucket_id<>'store-images') with check (bucket_id<>'store-images');

commit;
