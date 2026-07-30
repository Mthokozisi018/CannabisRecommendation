alter table public.staff_profiles
  add column if not exists alternative_phone text,
  add column if not exists country text,
  add column if not exists employee_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_profiles_country_check') then
    alter table public.staff_profiles
      add constraint staff_profiles_country_check
      check (country is null or country = 'South Africa');
  end if;
end $$;
