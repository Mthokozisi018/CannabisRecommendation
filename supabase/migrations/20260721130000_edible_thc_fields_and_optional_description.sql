alter table public.products
  alter column description drop not null,
  add column if not exists thc_per_unit_mg numeric,
  add column if not exists thc_per_packet_mg numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_thc_per_unit_mg_nonnegative') then
    alter table public.products
      add constraint products_thc_per_unit_mg_nonnegative
      check (thc_per_unit_mg is null or thc_per_unit_mg >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'products_thc_per_packet_mg_nonnegative') then
    alter table public.products
      add constraint products_thc_per_packet_mg_nonnegative
      check (thc_per_packet_mg is null or thc_per_packet_mg >= 0);
  end if;
end $$;
