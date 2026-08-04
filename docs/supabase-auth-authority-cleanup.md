# Supabase Auth authority cleanup

## Current authority

Supabase Auth is the only authentication and server-side session authority.
It owns credentials, password verification, access and refresh tokens, password
recovery, invitation email sessions, session refresh, and sign-out.

GreenChoice continues to authorize authenticated users from current staff and
store records. Account restrictions, store restrictions, roles, RLS, store
isolation, transaction boundaries, audit records, and business-action rate
limits remain unchanged.

## Duplicate systems removed

The configured Supabase project returned `404` for `greenchoice_sessions`. The
custom session migration had therefore not been applied to that project, while
the login route still attempted to insert a row after successful Supabase
authentication. That unavailable dependency caused successful credentials to
be reported as `Authentication is temporarily unavailable`.

The cleanup removed:

- The `greenchoice_sessions` table definition from the unapplied migration.
- The `greenchoice_activity_session` cookie and server helper.
- Custom session creation, validation, touching, and revocation calls.
- The activity heartbeat endpoint and its application rate limit.
- Custom session checks from route guards, onboarding, and server actions.
- Duplicate authentication rate limits from sign-in and password recovery.

The manager "logged in today" summary now reads Supabase Auth
`last_sign_in_at` values for staff assigned to the manager's store.

## Inactivity interface

`SessionActivityMonitor` remains interface-only. It observes pointer, keyboard,
and touch input, shows the existing warning, synchronizes the warning between
open tabs, listens for Supabase sign-out events, and calls Supabase `signOut()`
when the local 20-minute timer expires.

It does not create an authentication cookie, write heartbeat records, authorize
protected requests, or treat background requests as activity. Protected routes
continue to validate the current Supabase user and then apply GreenChoice
account and store authorization.

## Supabase settings still required

1. Confirm that the project is on a plan that supports Auth inactivity timeout.
2. In Supabase Dashboard, open Authentication, then Sessions.
3. Set Inactivity timeout to 20 minutes after approval and staging verification.
4. Record the JWT expiry because server-side enforcement can occur after the
   inactivity duration plus the remaining JWT lifetime.
5. Do not enable Time-box user sessions unless a separate absolute lifetime is
   approved.
6. Review Auth rate limits and invitation/recovery redirect allow-lists.
7. Test foreground and background tabs, automatic refresh, Next.js prefetch,
   and direct protected requests after the inactivity window.

No Supabase Dashboard setting or live migration was changed by this cleanup.

## Remaining limitation

The browser warning signs normal interactive sessions out at 20 minutes of
genuine inactivity, but it is not a server authorization authority. Exact
server-side rejection at precisely 20 minutes depends on the approved Supabase
session configuration and its refresh/JWT behavior.

Manual manager registration now requires trusted Supabase app metadata and a
compulsory temporary-password replacement during onboarding. Manager email
invitation activation has been retired; receptionist invitations remain active.
