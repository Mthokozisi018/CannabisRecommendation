-- Manager invitation completion is owned by complete_manager_invitation().
-- The legacy profile trigger changed the invitation first, causing the secure
-- RPC's guarded update to raise a retryable serialization error indefinitely.
drop trigger if exists staff_profiles_mark_invitation_accepted on public.staff_profiles;
drop function if exists public.mark_manager_invitation_accepted();

comment on function public.complete_manager_invitation(uuid) is
  'Atomically creates the exact invited manager profile, accepts the invitation, and writes its audit record.';
