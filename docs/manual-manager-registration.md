# Manual Manager Registration

Manager credentials are created directly in Supabase Auth. GreenChoice does not
send manager invitation emails or accept manager invitation links.

1. In Supabase, open **Authentication > Users > Add user > Create new user**.
2. Enter the manager email and a strong temporary password.
3. Enable automatic email confirmation.
4. Sign in to GreenChoice as the sole administrator.
5. Open **Connect Manager** on the administrator dashboard.
6. Enter the exact email used for the confirmed Supabase Auth user.

The protected server action adds these values to the Auth user's **app metadata**
(not user metadata) while preserving Supabase's existing metadata fields:

```json
{
  "greenchoice_role": "manager",
  "greenchoice_registration": "manual"
}
```

The action uses the Supabase service role only on the server, rejects existing
admin/receptionist/profile conflicts, and writes an audit record. Never edit
`auth.users` directly with browser-supplied SQL.

The manager signs in through the normal GreenChoice login page. On first login,
GreenChoice verifies the marker directly from `auth.users`, creates an active but
onboarding-incomplete manager profile, and requires the temporary password to be
replaced before store registration can continue.

Never put either marker in user metadata. Users can edit user metadata, so it is
not an authorization source.
