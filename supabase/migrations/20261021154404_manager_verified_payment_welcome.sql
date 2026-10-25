begin;

-- Null for accounts activated before this feature was installed. Only the
-- verified onboarding transition can make a billing account welcome-eligible.
alter table public.billing_accounts
  add column welcome_available_at timestamptz;

create function public.mark_verified_billing_welcome_available()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
begin
  if old.onboarding_paid_at is null
    and new.onboarding_paid_at is not null
    and new.status = 'active'
    and exists (
      select 1 from public.billing_payments p
      where p.account_id = new.id
        and p.purpose = 'onboarding'
        and p.status = 'success'
        and p.initial_monthly_amount_cents is not null
        and p.paid_at = new.onboarding_paid_at
    ) then
    new.welcome_available_at := now();
  end if;
  return new;
end $$;

create trigger mark_verified_billing_welcome_available
before update of onboarding_paid_at on public.billing_accounts
for each row execute function public.mark_verified_billing_welcome_available();

revoke all on function public.mark_verified_billing_welcome_available()
  from public, anon, authenticated;

create table public.manager_welcome_completions (
  profile_id uuid primary key references public.staff_profiles(id) on delete cascade,
  completed_at timestamptz not null default now()
);

alter table public.manager_welcome_completions enable row level security;
revoke all on public.manager_welcome_completions from public, anon, authenticated;
grant all on public.manager_welcome_completions to service_role;

create table public.manager_welcome_offers (
  profile_id uuid primary key references public.staff_profiles(id) on delete cascade,
  offered_at timestamptz not null default now()
);

alter table public.manager_welcome_offers enable row level security;
revoke all on public.manager_welcome_offers from public, anon, authenticated;
grant all on public.manager_welcome_offers to service_role;

commit;
