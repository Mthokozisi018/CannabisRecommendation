# GreenChoice Paystack staging implementation report

## Implemented

- Staging-only server Paystack client. The key is read only on the server, must have the `sk_test_` prefix, and is rejected unless `GREENCHOICE_ENV=staging` and `PAYSTACK_MODE=test`. Hosted checkout needs no public key.
- GreenChoice SaaS billing tables are separate from retail orders and POS payments. Five new tables cover accounts, subscriptions, payments, provider events, and price changes. Browser roles have no direct read or write grants; every table has RLS. A verified payment RPC handles callback/webhook races.
- One pending onboarding payment per organization. Backend pricing uses ZAR cents: R2,500 independent, R4,500 franchise. Verification checks provider success, test domain, exact reference, amount, currency, payer email, and billing organization metadata before activation.
- Account-specific monthly Paystack plans and scheduled subscription creation after a reusable card authorization. The first debit is set one month after onboarding. A database claim prevents two workers provisioning the same subscription. Uncertain provider results require manual reconciliation to avoid a second subscription.
- R1,500 independent monthly fee. Franchise monthly fee is R2,300 with the first operationally active store, then R1,000 for each additional active store. Franchise store changes update only that franchise's plan for the next renewal, with a price-change ledger. Payment restriction does not change the operational store count.
- Signed webhook with raw-body HMAC SHA512 validation and duplicate-event tracking. It reconciles onboarding, successful recurring invoices, failed invoices, subscription lifecycle, and payment-method summaries. A failed recurring debit starts four days of grace. An hourly Supabase Cron job restricts an unresolved account after the deadline, without deleting operational data.
- Independent and franchise billing page with status, pricing, masked card summary, due date, history, onboarding checkout, overdue payment checkout, and hosted card-update link. The designated first independent manager or Franchise Administrator owns billing. The dashboard and central staff-action guards preserve billing recovery access while limiting unpaid operational access.

## Staging verification

- `.env.staging.local` contains a test-format secret, `PAYSTACK_MODE=test`, and a staging-only billing flag; it is Git-ignored. The staging runner loads the file. The staging verifier checks the key format without printing it.
- The configured staging Supabase ID matches the project named **GreenChoice Staging** and differs from production. The CLI initially pointed to production; it was explicitly linked to staging before database work, then restored to its original production link afterward. Future staging commands must specify and verify the staging project again.
- The staging database's migration history differs from this checkout. A normal `db push --dry-run` refused to proceed. The billing migration alone was tested in a rollback transaction on the verified staging project, then applied there with an explicit project reference. Only version `20261020180659` was marked applied. Five RLS tables, one hourly grace job, and denied browser-role payment permissions were confirmed. On 21 October 2026 the staging database had one franchise billing account and one pending R4,500 onboarding payment linked to its owner.
- `npm run build:staging`, `npm run typecheck`, targeted ESLint, targeted unit/security tests, migration filename/security validation, staging environment validation, and secret scanning passed. Provider calls in unit tests were mocked. No genuine Paystack request, hosted checkout, card charge, or webhook delivery has been tested.

## Public staging handoff

- The dedicated `greenchoice-workstation-staging` Vercel project serves the `staging` branch at `https://greenchoice-workstation-staging.vercel.app`. Its Vercel production target belongs to this separate staging project; GreenChoice's live Vercel project and `main` branch are outside this deployment.
- The staging project variables use that origin for `APP_URL`, `NEXT_PUBLIC_APP_URL`, `ALLOWED_ORIGINS`, `PAYSTACK_CALLBACK_URL` (`/billing/payment/callback`), and `PAYSTACK_WEBHOOK_URL` (`/api/payments/paystack/webhook`). The app requires a test key and staging Supabase identity. The project-ID guard permits staging identity on this dedicated Vercel project while retaining the live project's production guard.
- A Paystack Test Mode initialize request with a synthetic email and the R4,500 amount returned a hosted checkout URL. It did not complete a payment. Confirm the Test Mode webhook URL in the Paystack dashboard, then let the authorized Franchise Administrator complete an interactive test checkout. Verify the callback, signed webhook, and staging billing rows; a browser redirect alone must not activate access.

## Limits before a wider rollout

- Interactive checkout, callback reconciliation, and signed webhook delivery still need an authorized Franchise Administrator test payment and Paystack Test Mode dashboard confirmation.
- Billing owner transfer to a different person needs a provider-safe customer/card migration and an acceptance flow. This release keeps one designated initial owner and does not expose an unsafe transfer control.
- Cancellation and outbound payment-failure email are not yet wired. The billing page shows an in-app grace notice. Paystack does not automatically retry a failed subscription; the owner has an explicit overdue checkout and card-update flow.
- A failed Paystack plan update after a franchise store change is surfaced to the Franchise Administrator. Automatic background retries need a verified public staging worker before broader use.
- Operational dashboard and central staff-action guards enforce billing state. Other service-role routes and direct database operations must be audited before treating this as a production-wide entitlement system. Billing is disabled outside staging.
