# GreenChoice Supabase Auth Setup

This guide finishes the real Supabase Auth setup for local GreenChoice manager and receptionist login.

Do not commit real Supabase keys. Keep them in `.env.local` or your deployment provider's secret manager only.

## 1. Create The Supabase Project

1. Go to the Supabase dashboard.
2. Create a new project for GreenChoice.
3. Wait for the project to finish provisioning.
4. Open **Project Settings > API**.

You need:

- **Project URL**: use this as `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key**: use this as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key**: use this as `SUPABASE_SERVICE_ROLE_KEY`

The anon key is allowed in browser code. The service role key is server-only and must never be exposed to client components.

## 2. Configure Local Environment

In `greenchoice-workstation/.env.local`, add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_URL=http://127.0.0.1:3001
```

If you run the Django API from the repository root and load environment variables there, also provide these same Supabase values to that backend process:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`.env.local` is ignored by Git. Do not paste real values into `.env.example`, README files, tests, or committed code.

## 3. Enable Email/Password Auth

In the Supabase dashboard:

1. Open **Authentication > Providers**.
2. Enable **Email**.
3. Enable password sign-ins.
4. Configure any email confirmation rules you want for the environment.

For local testing, also open **Authentication > URL Configuration** and add:

```text
http://127.0.0.1:3001/update-password
```

For deployment, add the production equivalent:

```text
https://your-production-domain/update-password
```

## 4. Run The Migration

The migration file is:

```text
supabase/migrations/20260616100000_staff_profiles_auth.sql
```

It creates `public.staff_profiles`, enables RLS, and adds policies for:

- authenticated users reading their own staff profile
- active managers reading staff profiles
- active managers inserting staff profiles
- active managers updating staff profiles

### Option A: Supabase CLI

If the Supabase CLI is installed and the project is linked:

```powershell
cd greenchoice-workstation
supabase link --project-ref your-project-ref
supabase db push
```

Only run `supabase db push` after confirming the linked project is the intended GreenChoice project.

## Manager invitation email template

Supabase Auth sends `inviteUserByEmail` messages from the remote Supabase project, so the production email design is controlled in the Supabase Dashboard.

To use the GreenChoice branded manager invitation email:

1. Open Supabase Dashboard > Authentication > Email Templates.
2. Select the **Invite user** template.
3. Set the subject to:
   `You've been invited to manage a GreenChoice store`
4. Paste the HTML from:
   `supabase/templates/invite-user.html`
5. Keep the button link as `{{ .ConfirmationURL }}`. Supabase replaces it with the secure invitation confirmation URL and preserves the app redirect configured by `inviteUserByEmail`.

The invite link opens the GreenChoice temporary credentials page. That page displays the invited email and one server-generated temporary password once, then signs out the invite session so the manager must log in manually.

For local testing from another device, set `.env.local` to your computer LAN URL, for example:

```env
APP_URL=http://192.168.x.x:3001
NEXT_PUBLIC_APP_URL=http://192.168.x.x:3001
```

Then add these in Supabase Dashboard > Authentication > URL Configuration:

```text
Site URL: http://192.168.x.x:3001
Redirect URLs:
http://192.168.x.x:3001/**
http://192.168.x.x:3001/manager/invitation/set-password
```

For same-computer local testing, `http://127.0.0.1:3001` works only on that computer. Phones and tablets need the LAN URL because their own `127.0.0.1` is not the development machine.

### Option B: Supabase Dashboard SQL Editor

If the CLI is not installed or not linked:

1. Open **SQL Editor** in the Supabase dashboard.
2. Open `supabase/migrations/20260616100000_staff_profiles_auth.sql`.
3. Paste the full SQL into the SQL editor.
4. Run it.
5. Confirm `public.staff_profiles` exists under **Table Editor**.
6. Confirm RLS is enabled for `staff_profiles`.

## 5. Create Auth Users

You can create the local test users with the seed script after `.env.local` is configured:

```powershell
cd C:\Users\MthokozisiP\booking_system\greenchoice-workstation
node scripts/seed-supabase-auth-users.mjs
```

The script is safe to run more than once. It creates or updates:

- `manager@greenchoice.local` with role `manager`
- `receptionist@greenchoice.local` with role `receptionist`

It also upserts matching `public.staff_profiles` rows with `is_active=true`.

Alternatively, create users manually in **Authentication > Users**:

1. Create a manager user with an email and password.
2. Create a receptionist user with an email and password.
3. Copy each user's Auth UID.

Do not store these passwords in the application database.

## 6. Insert Staff Profiles

After creating Auth users, insert matching rows in `public.staff_profiles`.

Use the copied Auth UIDs:

```sql
insert into public.staff_profiles (auth_user_id, email, full_name, role, is_active)
values
  ('MANAGER_AUTH_USER_UUID', 'MANAGER_EMAIL', 'GreenChoice Manager', 'manager', true),
  ('RECEPTIONIST_AUTH_USER_UUID', 'RECEPTIONIST_EMAIL', 'GreenChoice Receptionist', 'receptionist', true);
```

Allowed `role` values are:

- `manager`
- `receptionist`

To deactivate a staff member:

```sql
update public.staff_profiles
set is_active = false
where auth_user_id = 'AUTH_USER_UUID';
```

Inactive staff should be signed out and blocked from dashboards.

## 7. Test Login Locally

Start the Next.js app:

```powershell
cd C:\Users\MthokozisiP\booking_system\greenchoice-workstation
npm run dev
```

Open:

```text
http://127.0.0.1:3001/login
```

Test manager:

1. Log in with the manager Auth user.
2. Confirm redirect to `/dashboard/manager`.
3. Open `/dashboard/receptionist`.
4. Confirm access is allowed and the user remains a manager.

Test receptionist:

1. Log in with the receptionist Auth user.
2. Confirm redirect to `/dashboard/receptionist`.
3. Open `/dashboard/manager`.
4. Confirm the receptionist is redirected away from manager pages.

Test inactive account:

1. Set `is_active=false` for the receptionist profile.
2. Try logging in again.
3. Confirm the app signs the user out and shows the inactive account message.

Test password reset:

1. Open `/forgot-password`.
2. Enter a staff email.
3. Confirm the neutral success message appears.
4. Use the reset email link.
5. Confirm it opens `/update-password`.
6. Set a password with at least 8 characters, uppercase, lowercase, and a number.

## 8. Troubleshooting

If login succeeds in Supabase but the app returns to `/login?error=staff`, check that `staff_profiles.auth_user_id` exactly matches the Supabase Auth user UID.

If password reset links do not open the local update page, confirm the redirect URL is listed in Supabase Authentication URL settings.
