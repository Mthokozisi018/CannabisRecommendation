insert into public.categories (id, slug, name, sort_order, is_active)
values ('20000000-0000-4000-8000-000000000108', 'disposable-vapes', 'Disposable Vapes', 8, true)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

do $$
begin
  alter table public.products drop constraint if exists products_manager_category_check;

  alter table public.products add constraint products_manager_category_check check (
    category is null
    or category in (
      'Flower',
      'Vape Cartridges',
      'Disposable Vapes',
      'Edibles',
      'Concentrates',
      'Pre-Rolls',
      'Beverages',
      'Accessories'
    )
  ) not valid;
end $$;
