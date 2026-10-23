# Admin manager account and onboarding flow

The Admin dashboard keeps the approved cards and shared top-left Back navigation. The **Create Manager Account** screen creates credentials only. Its form contains exactly two inputs: **Manager Email** and one masked **Temporary Password** with a show/hide button, followed by one **Create Manager Account** button.

The server verifies the Admin session and request origin, applies the existing rate limit, rejects duplicate Auth or profile emails, and creates a confirmed Supabase Auth identity. It then calls the existing `bootstrap_manual_manager_profile` function as the new manager's authenticated session. The resulting active manager profile has no store or franchise assignment and all onboarding completion flags remain false. Temporary passwords are never stored in profile tables, logged, or returned from the action.

If profile bootstrapping fails, the new Auth identity is deleted. If deletion also fails, the identity is banned and its trusted manager marker is removed so it cannot gain application access. Existing identities are never deleted during duplicate handling or recovery.

## Manager journey

The manager signs in with the credentials supplied by the Admin and is routed to `/manager/setup/account`. This step collects the manager's personal and contact information, legal acceptance, and one **New Password** field. Password composition is left to Supabase Auth settings; the application adds no confirmation field or custom complexity rules.

After account setup, the manager is routed to `/manager/setup/store` and registers their own independent store. The existing `complete_manager_store_registration` transaction creates a unique store ID, assigns the manager, records the store confirmation, and writes its audit entry. A retry for an already assigned manager updates the same store rather than creating another one. The completion screen then opens the existing Manager dashboard, where the manager can add products, manage inventory, and create receptionist accounts.

Dashboard layouts and nested manager actions require completed onboarding on the server. Before store setup, direct requests to manager dashboard, inventory, sales, suppliers, and staff routes redirect to the next required setup step. RLS also returns no store-scoped records for a manager without a store and limits access to the assigned store afterward. Franchise registration and management remain separate.

## Database correction

Migration `20261011102153_admin_independent_store_manager.sql` had already reached the isolated staging project before the workflow correction. Forward migration `20261011103925_restore_manager_self_onboarding.sql` removes its Admin store-creation RPC and restores `complete_manual_manager_account_setup` to accept only a storeless manual manager. Both functions involved in onboarding remain restricted to `service_role`; browser clients continue through verified server actions.

Production has not been modified or deployed.

## Verification

The focused unit and security tests cover the exact two-input Admin form, one-field password replacement, Admin authorization, duplicate detection, Auth pagination, profile bootstrapping, cleanup, quarantine recovery, the corrective migration contract, and manager route gating. The opt-in staging Playwright test exercises the complete browser flow, checks that Admin provisioning creates no store, verifies failed store validation creates no record, retries store registration without duplication, confirms password replacement, checks dashboard access only after onboarding, and verifies cross-store RLS isolation.

Run the staging journey with:

```powershell
$env:GREENCHOICE_ADMIN_MANAGER_E2E='true'
npm run test:e2e -- tests/e2e/admin-manager-creation.spec.ts --workers=1
```
