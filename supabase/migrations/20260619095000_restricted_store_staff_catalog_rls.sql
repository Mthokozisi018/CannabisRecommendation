create or replace function public.is_greenchoice_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.staff_profiles sp
    left join public.stores s on s.id = sp.store_id
    where (sp.user_id = auth.uid() or sp.auth_user_id = auth.uid())
      and sp.role in ('manager', 'receptionist')
      and sp.is_active = true
      and coalesce(sp.account_status, 'active') = 'active'
      and coalesce(s.store_access_status, 'active') = 'active'
  );
$$;

drop policy if exists products_staff_select on public.products;
create policy products_staff_select on public.products for select using (
  public.is_greenchoice_staff()
  and public.is_store_access_active(store_id)
);
