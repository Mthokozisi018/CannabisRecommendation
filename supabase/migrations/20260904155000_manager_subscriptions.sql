create table if not exists public.manager_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  manager_auth_user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text unique,
  stripe_price_id text,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'grace_period', 'restricted', 'canceled', 'incomplete', 'unpaid')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  current_period_ends_at timestamptz,
  payment_method_ready boolean not null default false,
  grace_period_ends_at timestamptz,
  last_payment_failed_at timestamptz,
  last_payment_succeeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manager_subscriptions_manager_auth_user_id_idx
  on public.manager_subscriptions(manager_auth_user_id);

create index if not exists manager_subscriptions_status_idx
  on public.manager_subscriptions(status);

alter table public.manager_subscriptions enable row level security;

revoke all on table public.manager_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.manager_subscriptions to service_role;

comment on table public.manager_subscriptions is
  'Server-managed Stripe Billing state for one GreenChoice manager subscription per store. Card data is never stored here.';
