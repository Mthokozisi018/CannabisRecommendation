-- New franchise subscriptions use R2,500 base from this migration onward.
-- Existing subscription rows and Paystack plans are intentionally unchanged.
begin;
create or replace function public.record_verified_billing_payment(
  p_reference text, p_provider_transaction_id bigint, p_paid_at timestamptz,
  p_customer_code text, p_authorization_code text, p_card_last4 text, p_card_brand text
) returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare charge public.billing_payments%rowtype;
declare account public.billing_accounts%rowtype;
declare store_count integer;
declare monthly_amount integer;
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
  update public.billing_payments set status='success', provider_transaction_id=p_provider_transaction_id,
    paid_at=p_paid_at, updated_at=now() where id=charge.id;
  if charge.purpose='onboarding' then
    update public.billing_accounts set status='active', onboarding_paid_at=p_paid_at,
      grace_ends_at=null, updated_at=now() where id=charge.account_id and onboarding_paid_at is null;
    select * into account from public.billing_accounts where id=charge.account_id;
    if account.franchise_id is null then store_count := 1; monthly_amount := 150000;
    else
      select count(*) into store_count from public.stores where franchise_id=account.franchise_id and is_active;
      monthly_amount := 250000 + greatest(store_count - 1, 0) * 100000;
    end if;
    insert into public.billing_subscriptions(account_id,paystack_customer_code,authorization_code,
      card_last4,card_brand,monthly_amount_cents,billable_store_count,status,first_due_at,next_payment_at)
    values(charge.account_id,p_customer_code,p_authorization_code,p_card_last4,p_card_brand,
      monthly_amount,store_count,case when p_customer_code is not null and p_authorization_code is not null
      then 'pending' else 'attention' end,p_paid_at + interval '1 month',p_paid_at + interval '1 month')
    on conflict (account_id) do nothing;
  else
    update public.billing_accounts set status='active', grace_ends_at=null, updated_at=now()
      where id=charge.account_id and onboarding_paid_at is not null;
    update public.billing_subscriptions set status='active', failed_at=null,
      last_paid_at=p_paid_at, updated_at=now() where account_id=charge.account_id;
  end if;
  update public.billing_subscriptions set paystack_customer_code=coalesce(p_customer_code,paystack_customer_code),
    authorization_code=coalesce(p_authorization_code,authorization_code),
    card_last4=coalesce(p_card_last4,card_last4), card_brand=coalesce(p_card_brand,card_brand),
    updated_at=now() where account_id=charge.account_id;
  return charge.account_id;
end $$;
revoke all on function public.record_verified_billing_payment(text,bigint,timestamptz,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_verified_billing_payment(text,bigint,timestamptz,text,text,text,text) to service_role;


commit;

