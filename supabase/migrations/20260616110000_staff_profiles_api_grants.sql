grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on table public.staff_profiles to authenticated;
grant all privileges on table public.staff_profiles to service_role;

grant execute on function public.is_greenchoice_manager() to authenticated, service_role;
