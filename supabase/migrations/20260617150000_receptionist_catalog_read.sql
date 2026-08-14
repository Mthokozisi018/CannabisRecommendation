create or replace function public.is_greenchoice_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where (sp.user_id = auth.uid() or sp.auth_user_id = auth.uid())
      and sp.role in ('manager', 'receptionist')
      and sp.is_active = true
      and coalesce(sp.account_status, 'active') = 'active'
  );
$$;

grant execute on function public.is_greenchoice_staff() to authenticated, service_role;

drop policy if exists products_staff_select on public.products;
create policy products_staff_select
on public.products
for select
using (public.is_greenchoice_staff());

drop policy if exists inventory_stock_staff_select on public.inventory_stock;
create policy inventory_stock_staff_select
on public.inventory_stock
for select
using (public.is_greenchoice_staff());
