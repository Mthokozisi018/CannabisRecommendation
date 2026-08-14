create or replace function public.greenchoice_is_whole_number(value numeric)
returns boolean
language sql
immutable
as $$
  select value is not null and value = trunc(value);
$$;

update public.inventory_stock
set
  current_quantity = round(current_quantity),
  low_stock_threshold = round(low_stock_threshold)
where
  current_quantity <> round(current_quantity)
  or low_stock_threshold <> round(low_stock_threshold);

update public.inventory_movements
set
  quantity_changed = sign(quantity_changed) * round(abs(quantity_changed)),
  previous_quantity = round(previous_quantity),
  new_quantity = round(new_quantity)
where
  abs(quantity_changed) <> round(abs(quantity_changed))
  or previous_quantity <> round(previous_quantity)
  or new_quantity <> round(new_quantity);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_stock_current_quantity_integer_check') then
    alter table public.inventory_stock add constraint inventory_stock_current_quantity_integer_check
      check (public.greenchoice_is_whole_number(current_quantity)) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inventory_stock_low_stock_threshold_integer_check') then
    alter table public.inventory_stock add constraint inventory_stock_low_stock_threshold_integer_check
      check (public.greenchoice_is_whole_number(low_stock_threshold)) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inventory_movements_quantity_changed_integer_check') then
    alter table public.inventory_movements add constraint inventory_movements_quantity_changed_integer_check
      check (public.greenchoice_is_whole_number(abs(quantity_changed))) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inventory_movements_previous_quantity_integer_check') then
    alter table public.inventory_movements add constraint inventory_movements_previous_quantity_integer_check
      check (public.greenchoice_is_whole_number(previous_quantity)) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inventory_movements_new_quantity_integer_check') then
    alter table public.inventory_movements add constraint inventory_movements_new_quantity_integer_check
      check (public.greenchoice_is_whole_number(new_quantity)) not valid;
  end if;
end $$;

alter table public.inventory_stock validate constraint inventory_stock_current_quantity_integer_check;
alter table public.inventory_stock validate constraint inventory_stock_low_stock_threshold_integer_check;
alter table public.inventory_movements validate constraint inventory_movements_quantity_changed_integer_check;
alter table public.inventory_movements validate constraint inventory_movements_previous_quantity_integer_check;
alter table public.inventory_movements validate constraint inventory_movements_new_quantity_integer_check;
