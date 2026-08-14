update public.staff_profiles sp
set store_id = s.id
from (
  select id
  from public.stores
  order by created_at asc
  limit 1
) s
where sp.store_id is null
  and sp.role in ('manager', 'receptionist');
