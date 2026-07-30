create or replace function public.greenchoice_is_whole_number(value numeric)
returns boolean
language sql
immutable
as $$
  select value is not null and value = trunc(value);
$$;

do $$
begin
  alter table public.products drop constraint if exists products_manager_cultivation_check;

  if not exists (select 1 from pg_constraint where conname = 'products_manager_cultivation_check') then
    alter table public.products add constraint products_manager_cultivation_check check (
      (category in ('Flower','Pre-Rolls') and cultivation_type in ('Indoor','Greenhouse','Outdoor'))
      or (category not in ('Flower','Pre-Rolls') and cultivation_type is null)
      or category is null
    ) not valid;
  end if;

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

create or replace function public.reject_fractional_stock_audit_details()
returns trigger
language plpgsql
as $$
declare
  stock_key text;
  stock_value numeric;
  stock_keys text[] := array['quantity', 'quantityChanged', 'previousQuantity', 'newQuantity', 'currentQuantity', 'lowStockThreshold'];
begin
  if new.action ilike '%stock%' or new.action ilike '%inventory%' then
    foreach stock_key in array stock_keys
    loop
      if new.details ? stock_key then
        begin
          stock_value := (new.details ->> stock_key)::numeric;
        exception when invalid_text_representation then
          raise exception 'Audit stock quantity % must be a whole number.', stock_key;
        end;

        if not public.greenchoice_is_whole_number(abs(stock_value)) then
          raise exception 'Audit stock quantity % must be a whole number.', stock_key;
        end if;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_logs_reject_fractional_stock_details on public.audit_logs;
create trigger audit_logs_reject_fractional_stock_details
before insert or update on public.audit_logs
for each row execute function public.reject_fractional_stock_audit_details();
