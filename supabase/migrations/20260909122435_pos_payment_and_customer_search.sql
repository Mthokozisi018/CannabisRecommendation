-- Reconcile the POS payment migration with production version 20260913155800.
-- Production already has the tender columns, allocation constraint, function,
-- and indexes. The missing payment_status column and v3 function update are
-- additive; the guards also keep this valid on a database without that version.
begin;
set local search_path = public, extensions;

-- NULL means payment was not recorded on historical/legacy sales. Do not guess cash.
alter table public.pos_sales
  add column if not exists payment_method text,
  add column if not exists cash_amount numeric(12,2),
  add column if not exists card_amount numeric(12,2),
  add column if not exists payment_status text not null default 'not_recorded';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_payment_allocation_check'
  ) then
    alter table public.pos_sales add constraint pos_sales_payment_allocation_check check (
    (payment_method is null and cash_amount is null and card_amount is null)
    or (
      payment_method is not null and cash_amount is not null and card_amount is not null
      and payment_method in ('cash', 'card', 'split')
      and cash_amount >= 0 and cash_amount <= total
      and card_amount >= 0 and card_amount <= total
      and cash_amount + card_amount = total
      and (payment_method <> 'cash' or card_amount = 0)
      and (payment_method <> 'card' or cash_amount = 0)
    )
    );
  end if;
end $$;

comment on column public.pos_sales.payment_method is 'POS tender: cash, card, split; NULL means unrecorded legacy payment.';
comment on column public.pos_sales.cash_amount is 'Cash portion in ZAR; recorded atomically with the sale.';
comment on column public.pos_sales.card_amount is 'Card portion in ZAR; no card credentials are stored.';

-- Reuse the existing authorized, locked stock/sale operation in the SAME transaction.
-- Any payment error rolls back its sale, items, movements, audit and stock updates.
grant execute on function public.complete_receptionist_sale_v2(uuid, uuid, uuid, jsonb)
  to service_role;

create or replace function public.complete_receptionist_sale_v3(
  p_checkout_id uuid, p_auth_user_id uuid, p_customer_id uuid, p_items jsonb,
  p_payment_method text, p_cash_amount numeric, p_card_amount numeric
)
returns table(sale_id uuid, subtotal numeric, total numeric, already_completed boolean)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  completed record;
  saved record;
begin
  if p_payment_method is null or p_payment_method not in ('cash', 'card', 'split')
    or p_cash_amount is null or p_card_amount is null
    or p_cash_amount::text in ('NaN', 'Infinity', '-Infinity')
    or p_card_amount::text in ('NaN', 'Infinity', '-Infinity')
    or p_cash_amount < 0 or p_card_amount < 0
    or p_cash_amount <> round(p_cash_amount, 2)
    or p_card_amount <> round(p_card_amount, 2) then
    raise exception using errcode = '22023', message = 'Invalid payment amounts.';
  end if;

  select * into completed from public.complete_receptionist_sale_v2(
    p_checkout_id, p_auth_user_id, p_customer_id, p_items
  );

  if p_cash_amount > completed.total or p_card_amount > completed.total
    or p_cash_amount + p_card_amount <> completed.total
    or (p_payment_method = 'cash' and p_card_amount <> 0)
    or (p_payment_method = 'card' and p_cash_amount <> 0) then
    raise exception using errcode = '22023', message = 'Payment must match the final sale total.';
  end if;

  if completed.already_completed then
    select ps.payment_method, ps.cash_amount, ps.card_amount into saved
    from public.pos_sales ps where ps.id = completed.sale_id;
    if saved.payment_method is distinct from p_payment_method
      or saved.cash_amount is distinct from p_cash_amount
      or saved.card_amount is distinct from p_card_amount then
      raise exception using errcode = '22023', message = 'Payment differs from the completed sale.';
    end if;
  else
    update public.pos_sales ps set payment_method = p_payment_method,
      cash_amount = p_cash_amount, card_amount = p_card_amount, payment_status = 'paid'
    where ps.id = completed.sale_id;

    update public.audit_logs al
    set details = coalesce(al.details, '{}'::jsonb) || jsonb_build_object(
      'paymentMethod', p_payment_method, 'cashAmount', p_cash_amount, 'cardAmount', p_card_amount
    )
    where al.record_id = completed.sale_id and al.action = 'receptionist_completed_pos_sale';
  end if;

  return query select completed.sale_id, completed.subtotal, completed.total, completed.already_completed;
end;
$$;

revoke all on function public.complete_receptionist_sale_v3(uuid, uuid, uuid, jsonb, text, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_receptionist_sale_v3(uuid, uuid, uuid, jsonb, text, numeric, numeric)
  to service_role;

-- Existing B-tree indexes cannot accelerate leading-wildcard ILIKE name searches.
-- Partial phone search now uses bounded phone_digits prefixes against the existing
-- store/phone_digits index from 20260830180534. Keep trigram support for names.
create extension if not exists pg_trgm;
create index if not exists pos_customers_first_name_trgm_idx on public.pos_customers using gin (first_name gin_trgm_ops) where deleted_at is null;
create index if not exists pos_customers_surname_trgm_idx on public.pos_customers using gin (surname gin_trgm_ops) where deleted_at is null;
create index if not exists pos_customers_full_name_trgm_idx on public.pos_customers using gin (full_name gin_trgm_ops) where deleted_at is null;
create index if not exists pos_customers_store_recent_idx on public.pos_customers (store_id, updated_at desc) where deleted_at is null;
commit;
