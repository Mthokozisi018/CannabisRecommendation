begin;

-- A single initial Paystack charge contains onboarding and the first month.
-- Null values identify older onboarding-only payments and preserve their terms.
alter table public.billing_payments
  add column initial_monthly_amount_cents integer,
  add column initial_billable_store_count integer,
  add constraint billing_initial_month_snapshot_check check (
    (initial_monthly_amount_cents is null and initial_billable_store_count is null)
    or (initial_monthly_amount_cents > 0 and initial_billable_store_count >= 0)
  );

create or replace function public.record_verified_billing_payment(
  p_reference text, p_provider_transaction_id bigint, p_paid_at timestamptz,
  p_customer_code text, p_authorization_code text, p_card_last4 text, p_card_brand text
) returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare charge public.billing_payments%rowtype;
declare account public.billing_accounts%rowtype;
declare store_count integer;
declare monthly_amount integer;
declare onboarding_amount integer;
begin
  select * into charge from public.billing_payments where reference = p_reference for update;
  if charge.id is null then raise exception 'Unknown billing reference' using errcode = '22023'; end if;
  if charge.status = 'success' then
    if charge.provider_transaction_id is distinct from p_provider_transaction_id then
      raise exception 'Transaction reference conflict' using errcode = '23505';
    end if;
    return charge.account_id;
  end if;
  if charge.status <> 'pending' then raise exception 'Billing charge is closed' using errcode = '22023'; end if;

  select * into account from public.billing_accounts where id = charge.account_id for update;
  if account.id is null then raise exception 'Unknown billing account' using errcode = '22023'; end if;
  if charge.purpose = 'onboarding' then
    if account.onboarding_paid_at is not null then
      raise exception 'Onboarding was already paid' using errcode = '23505';
    end if;
    onboarding_amount := case when account.franchise_id is null then 250000 else 450000 end;
    if charge.initial_monthly_amount_cents is not null then
      if charge.initial_billable_store_count is null
        or (account.franchise_id is null and
          (charge.initial_billable_store_count <> 1 or charge.initial_monthly_amount_cents <> 150000))
        or (account.franchise_id is not null and charge.initial_monthly_amount_cents <>
          250000 + greatest(charge.initial_billable_store_count - 1, 0) * 100000)
        or charge.amount_cents <> onboarding_amount + charge.initial_monthly_amount_cents then
        raise exception 'Initial payment snapshot is invalid' using errcode = '22023';
      end if;
      store_count := charge.initial_billable_store_count;
      monthly_amount := charge.initial_monthly_amount_cents;
    else
      if charge.amount_cents <> onboarding_amount then
        raise exception 'Legacy onboarding amount is invalid' using errcode = '22023';
      end if;
      if account.franchise_id is null then store_count := 1; monthly_amount := 150000;
      else
        select count(*) into store_count from public.stores
          where franchise_id = account.franchise_id and is_active;
        monthly_amount := 250000 + greatest(store_count - 1, 0) * 100000;
      end if;
    end if;
  end if;

  update public.billing_payments set status = 'success',
    provider_transaction_id = p_provider_transaction_id, paid_at = p_paid_at, updated_at = now()
    where id = charge.id;
  if charge.purpose = 'onboarding' then
    update public.billing_accounts set status = 'active', onboarding_paid_at = p_paid_at,
      grace_ends_at = null, updated_at = now() where id = charge.account_id;
    insert into public.billing_subscriptions(account_id,paystack_customer_code,authorization_code,
      card_last4,card_brand,monthly_amount_cents,billable_store_count,status,first_due_at,next_payment_at,last_paid_at)
    values(charge.account_id,p_customer_code,p_authorization_code,p_card_last4,p_card_brand,
      monthly_amount,store_count,case when p_customer_code is not null and p_authorization_code is not null
      then 'pending' else 'attention' end,p_paid_at + interval '1 month',p_paid_at + interval '1 month',
      case when charge.initial_monthly_amount_cents is not null then p_paid_at else null end)
    on conflict (account_id) do nothing;
  else
    update public.billing_accounts set status = 'active', grace_ends_at = null, updated_at = now()
      where id = charge.account_id and onboarding_paid_at is not null;
    update public.billing_subscriptions set status = 'active', failed_at = null,
      last_paid_at = p_paid_at, updated_at = now() where account_id = charge.account_id;
  end if;
  update public.billing_subscriptions set paystack_customer_code = coalesce(p_customer_code,paystack_customer_code),
    authorization_code = coalesce(p_authorization_code,authorization_code),
    card_last4 = coalesce(p_card_last4,card_last4), card_brand = coalesce(p_card_brand,card_brand),
    updated_at = now() where account_id = charge.account_id;
  return charge.account_id;
end $$;

revoke all on function public.record_verified_billing_payment(text,bigint,timestamptz,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.record_verified_billing_payment(text,bigint,timestamptz,text,text,text,text)
  to service_role;

commit;
