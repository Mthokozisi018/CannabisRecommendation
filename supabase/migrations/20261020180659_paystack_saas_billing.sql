begin;

-- SaaS fees are separate from customer orders and store access controls.
create table public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete restrict,
  franchise_id uuid references public.franchises(id) on delete restrict,
  owner_profile_id uuid not null references public.staff_profiles(id) on delete restrict,
  status text not null default 'onboarding_due' check (status in ('onboarding_due','active','grace','restricted','cancelled')),
  onboarding_paid_at timestamptz,
  grace_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_account_one_business check ((store_id is null) <> (franchise_id is null))
);
create unique index billing_accounts_store_unique on public.billing_accounts(store_id) where store_id is not null;
create unique index billing_accounts_franchise_unique on public.billing_accounts(franchise_id) where franchise_id is not null;
create index billing_accounts_owner_idx on public.billing_accounts(owner_profile_id);

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.billing_accounts(id) on delete restrict,
  paystack_customer_code text,
  paystack_plan_code text unique,
  paystack_subscription_code text unique,
  paystack_email_token text,
  authorization_code text,
  card_last4 text,
  card_brand text,
  monthly_amount_cents integer not null check (monthly_amount_cents > 0),
  billable_store_count integer not null default 1 check (billable_store_count >= 0),
  status text not null default 'pending' check (status in ('pending','provisioning','active','past_due','cancelled','attention')),
  first_due_at timestamptz,
  next_payment_at timestamptz,
  last_paid_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.billing_accounts(id) on delete restrict,
  reference text not null unique,
  payer_email text not null,
  provider_transaction_id bigint unique,
  purpose text not null check (purpose in ('onboarding','renewal','recovery')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  status text not null default 'pending' check (status in ('pending','success','failed')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index billing_one_successful_onboarding on public.billing_payments(account_id)
  where purpose = 'onboarding' and status = 'success';
create unique index billing_one_pending_onboarding on public.billing_payments(account_id)
  where purpose = 'onboarding' and status = 'pending';
create unique index billing_one_pending_recovery on public.billing_payments(account_id)
  where purpose = 'recovery' and status = 'pending';
create index billing_payments_account_time on public.billing_payments(account_id, created_at desc);

create table public.billing_provider_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  provider_reference text,
  status text not null default 'received' check (status in ('received','processed','ignored','error')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.billing_price_changes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.billing_accounts(id) on delete restrict,
  old_amount_cents integer not null,
  new_amount_cents integer not null,
  old_store_count integer not null,
  new_store_count integer not null,
  effective_at timestamptz not null,
  reason text not null,
  provider_plan_code text,
  created_at timestamptz not null default now()
);

alter table public.billing_accounts enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_provider_events enable row level security;
alter table public.billing_price_changes enable row level security;

-- No browser role can read authorization tokens or mutate payment state.
revoke all on public.billing_accounts, public.billing_subscriptions, public.billing_payments,
  public.billing_provider_events, public.billing_price_changes from public, anon, authenticated;
grant all on public.billing_accounts, public.billing_subscriptions, public.billing_payments,
  public.billing_provider_events, public.billing_price_changes to service_role;

-- Both callback and webhook can race; the first verified success wins atomically.
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
      monthly_amount := 230000 + greatest(store_count - 1, 0) * 100000;
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

create or replace function public.claim_billing_subscription(p_account_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  update public.billing_subscriptions set status='provisioning',updated_at=now()
    where account_id=p_account_id and status='pending' and paystack_subscription_code is null
      and paystack_customer_code is not null and authorization_code is not null;
  return found;
end $$;
revoke all on function public.claim_billing_subscription(uuid) from public,anon,authenticated;
grant execute on function public.claim_billing_subscription(uuid) to service_role;

create or replace function public.record_verified_billing_renewal(
  p_subscription_code text, p_reference text, p_provider_transaction_id bigint,
  p_amount_cents integer, p_paid_at timestamptz, p_customer_code text
) returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare sub public.billing_subscriptions%rowtype;
declare payer_email text;
begin
  select * into sub from public.billing_subscriptions
    where paystack_subscription_code=p_subscription_code for update;
  if sub.id is null or sub.paystack_customer_code is distinct from p_customer_code
    or sub.monthly_amount_cents <> p_amount_cents or sub.status='cancelled' then
    raise exception 'Renewal does not match a current subscription' using errcode='22023';
  end if;
  select email into payer_email from public.staff_profiles p join public.billing_accounts a
    on a.owner_profile_id=p.id where a.id=sub.account_id;
  insert into public.billing_payments(account_id,reference,payer_email,provider_transaction_id,
    purpose,amount_cents,status,paid_at)
  values(sub.account_id,p_reference,payer_email,p_provider_transaction_id,'renewal',p_amount_cents,'success',p_paid_at)
  on conflict (reference) do nothing;
  if not exists(select 1 from public.billing_payments where reference=p_reference
    and account_id=sub.account_id and provider_transaction_id=p_provider_transaction_id
    and amount_cents=p_amount_cents and status='success') then
    raise exception 'Renewal reference conflict' using errcode='23505';
  end if;
  if sub.last_paid_at is null or p_paid_at > sub.last_paid_at then
    update public.billing_subscriptions set status='active',failed_at=null,
      last_paid_at=p_paid_at,updated_at=now() where id=sub.id;
    update public.billing_accounts set status='active',grace_ends_at=null,updated_at=now()
      where id=sub.account_id and status in ('active','grace','restricted');
  end if;
  return sub.account_id;
end $$;
revoke all on function public.record_verified_billing_renewal(text,text,bigint,integer,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_verified_billing_renewal(text,text,bigint,integer,timestamptz,text) to service_role;

create or replace function public.record_billing_subscription_failure(
  p_subscription_code text, p_failed_at timestamptz
) returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare sub public.billing_subscriptions%rowtype;
begin
  select * into sub from public.billing_subscriptions
    where paystack_subscription_code=p_subscription_code for update;
  if sub.id is null or sub.status='cancelled' or (sub.last_paid_at is not null and sub.last_paid_at >= p_failed_at)
    or (sub.failed_at is not null and sub.failed_at >= p_failed_at) then return false; end if;
  update public.billing_subscriptions set status='past_due',failed_at=p_failed_at,updated_at=now()
    where id=sub.id;
  update public.billing_accounts set status='grace',grace_ends_at=p_failed_at + interval '4 days',updated_at=now()
    where id=sub.account_id and status in ('active','grace');
  return true;
end $$;
revoke all on function public.record_billing_subscription_failure(text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_billing_subscription_failure(text,timestamptz) to service_role;

create or replace function public.apply_billing_grace_expiry()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare affected integer;
begin
  update public.billing_accounts set status='restricted',updated_at=now()
    where status='grace' and grace_ends_at <= now();
  get diagnostics affected = row_count;
  return affected;
end $$;
revoke all on function public.apply_billing_grace_expiry() from public,anon,authenticated;
grant execute on function public.apply_billing_grace_expiry() to service_role;

-- Supabase Cron runs the grace check inside staging without an external secret.
create extension if not exists pg_cron;
do $$ begin
  if to_regnamespace('cron') is not null then
    perform cron.schedule('greenchoice-billing-grace-expiry', '0 * * * *',
      'select public.apply_billing_grace_expiry()');
  end if;
end $$;

commit;
