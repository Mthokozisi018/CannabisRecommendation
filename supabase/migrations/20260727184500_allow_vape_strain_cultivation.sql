alter table public.products
  drop constraint if exists products_manager_cultivation_check;

alter table public.products
  add constraint products_manager_cultivation_check check (
    (category in ('Flower','Pre-Rolls') and cultivation_type in ('Indoor','Greenhouse','Outdoor'))
    or (category = 'Vape Cartridges' and cultivation_type in ('Sativa','Indica','Hybrid'))
    or (category not in ('Flower','Pre-Rolls','Vape Cartridges') and cultivation_type is null)
  );
