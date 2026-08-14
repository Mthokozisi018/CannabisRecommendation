-- Distributed fallback for security-sensitive requests when Redis is unavailable.
-- The table is private and the RPC is executable only by the server-side service role.
create table if not exists private.request_rate_limits (
  key_hash text primary key,
  request_count integer not null check (request_count > 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint request_rate_limits_key_hash_format check (key_hash ~ '^greenchoice:rl:[^:]+:[0-9a-f]{64}:[0-9]+$')
);

alter table private.request_rate_limits enable row level security;
revoke all on table private.request_rate_limits from public, anon, authenticated;

create or replace function public.consume_request_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_ms integer
)
returns table(request_count integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_key_hash !~ '^greenchoice:rl:[^:]+:[0-9a-f]{64}:[0-9]+$'
    or p_limit < 1
    or p_window_ms < 1000
    or p_window_ms > 86400000 then
    raise exception 'Invalid rate-limit parameters.';
  end if;

  insert into private.request_rate_limits as limits (
    key_hash,
    request_count,
    reset_at,
    updated_at
  ) values (
    p_key_hash,
    1,
    v_now + (p_window_ms::text || ' milliseconds')::interval,
    v_now
  )
  on conflict (key_hash) do update
  set request_count = case
        when limits.reset_at <= v_now then 1
        else limits.request_count + 1
      end,
      reset_at = case
        when limits.reset_at <= v_now then v_now + (p_window_ms::text || ' milliseconds')::interval
        else limits.reset_at
      end,
      updated_at = v_now
  returning limits.request_count, limits.reset_at
  into request_count, reset_at;

  return next;
end;
$$;

revoke all on function public.consume_request_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_request_rate_limit(text, integer, integer) to service_role;
