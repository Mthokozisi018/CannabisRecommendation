# GreenChoice store QR registration implementation report

Implemented in the existing Next.js/Supabase workstation and its store-scoped
`pos_customers` model. The Django API was inspected; the active POS authentication,
customer lookup and sale transaction use the workstation's Supabase architecture.
No separate customer database or duplicate application was added. Existing
unrelated workspace modifications were preserved.

## Delivered behaviour

- Permanent unique store tokens, resolved on the server and checked again inside
  the atomic registration transaction. Invalid, expired, revoked, restricted and
  inactive store links fail safely.
- One mobile registration page with Your Details, Verify Your Document and
  Agreements; distinct rear-camera and gallery inputs; private document preview,
  replace/remove controls; accessible validation and retry states.
- Required email consistent with existing customer onboarding; required name and
  consistently normalised cellphone; SA ID and passport numbers retained as
  strings only while checking. No full document numbers are stored.
- Versioned legal documents and exact section links in a full-screen dialog,
  preserving the mounted form, selected photo, checkbox state and scroll position.
- Separate optional store-specific promotional consent with selected channels.
- Real image decoding, size/pixel limits, EXIF rotation and metadata stripping.
- A trusted provider adapter with explicit blocked/mismatch/unreadable/manual
  review/under-age/age-unconfirmed states. Full provider DOB resolves the SA ID
  century; a number match is never described as identity authenticity verification.
- Atomic customer/evidence/acknowledgement creation, idempotent replay and safe
  duplicate handling. Existing records cannot be publicly merged or taken over.
- Signed, short-lived success receipt containing only store and masked cellphone.
- Manager QR modal with store name, locally generated QR, download/share/copy.
- Immediate store-scoped phone search bypassing the index and client result cache;
  the old manual staff registration boundary now refuses unverified creation.
- Existing customer-linked checkout plus a database guard against cross-store sale
  inserts/updates. Store/customer references remain on completed POS sales and the
  existing store-scoped sales/history reporting.

## Migration

`supabase/migrations/20261007130205_store_qr_customer_registration.sql`

Created with the Supabase CLI and executed successfully in isolated PostgreSQL
tests. It has **not been applied to the configured hosted Supabase project**.

Adds `store_registration_tokens`, `qr_customer_registrations`,
`qr_document_cleanup`, `qr_registration_audits`, the private document bucket,
the service-only atomic registration RPC and the POS sale/customer/store trigger.

## Security and RLS

All new public-schema tables enable RLS and revoke browser-role access. Only the
trusted service role can provision/resolve tokens or commit registration/evidence.
No raw store ID or browser verification boolean is accepted. Existing POS customer
read policies continue to enforce store membership. Sensitive evidence remains
outside that staff-readable table.

The document bucket is private. A restrictive Storage policy prevents an existing
broad browser policy from exposing it. No public or signed document URLs are
produced. Automated processing/deletion/retry audit records contain only store,
submission, purpose and time. No human-review or override endpoint is introduced.

Public POST requests check origin and enforce the existing rate limiter before
reading multipart data, independently of customer-controlled token/phone/request
ID. Chunked bodies are bounded too. Errors never log image content, document
numbers or OCR output. Raw OCR is never persisted. Registration pages/API/provider
requests are filtered from Sentry; registration pages are excluded from analytics
and speed insights. Session replay is disabled globally to avoid recording the
form after client navigation.

Temporary images are removed after both success and failure. Crash/failed-delete
paths remain in the cleanup queue. Schedule the bundled cleanup command every
15 minutes; it uses the Storage API to delete queued objects older than one hour,
retries failed deletion and prints counts only.

## Required environment and provider status

No approved OCR/document provider was found in the application. The production
adapter is unconfigured and deliberately refuses to produce successful checks.
Tests inject synthetic provider results only into isolated tests.

New/server-only configuration:

| Variable | Required value/purpose |
| --- | --- |
| `QR_VERIFICATION_URL` | Approved gateway HTTPS endpoint |
| `QR_VERIFICATION_API_KEY` | Gateway bearer credential |
| `QR_VERIFICATION_APPROVED` | `true` only after approval and real integration testing |
| `QR_REGISTRATION_LEGAL_APPROVED` | `2026-10-07` after notice/processor/contact/retention review |
| `CUSTOMER_ID_HMAC_SECRET` | At least 32 random characters |
| `SESSION_SIGNING_SECRET` | Existing secret; at least 32 random characters |

Existing Supabase server keys, canonical application URL, allowed origins and
distributed rate-limit configuration remain required. No credentials were added
to tracked files. See [the operational guide](qr-registration.md) for the exact
provider request/response contract.

## Validation

- `npm run test -- --maxWorkers=2`: **378 tests passed across 64 files**. Includes
  nine registration test files, actual new-migration execution in PostgreSQL,
  store/RLS/storage denial tests, successful/failed checks, idempotency, safe
  receipts, public request validation and existing POS checkout tests.
- `npm run test:qr-ui`: **8 browser tests passed** using the real UI components
  in an isolated synthetic harness. Covers 360/390/430 px widths, larger text,
  camera/gallery attributes, preview/replace/remove, exact legal documents/anchor,
  preserved form/scroll/consent, optional marketing, focus, retry and disabled
  duplicate submissions, redirect and QR-modal reopening.
- `npm run build:local`: **passed**, including Next.js production compilation,
  TypeScript checking and route generation.
- `npm run typecheck`: **passed**; the final build also rechecked the latest code.
- `npm run validate:migrations`: **passed** for 65 migration files.
- `npm run scan:secrets`: **passed**.
- `npm run audit:production`: **passed**, zero production vulnerabilities.
- Built standalone-server HTTP smoke checks: **passed** for `/register`, an
  invalid-token registration page, `/legal/privacy`, and a success page without
  a receipt. Public pages did not redirect to staff login; registration responses
  had private/no-store caching, no-referrer policy and the intended camera policy.
  The smoke server used temporary HTTPS application-URL metadata; no environment
  file or hosted service was changed. Ordinary local HTTP URL metadata correctly
  fails the existing production-runtime HTTPS configuration guard.
- Lint: no errors; one pre-existing warning in
  `components/customer/CustomerCheckout.tsx` about `window.location.assign`.
- Sharp was updated to pinned **0.35.5**; production dependency audit reports no
  vulnerabilities. QR generation uses pinned `qrcode@1.5.4`; isolated database
  tests use dev-only `@electric-sql/pglite@0.5.8`.

An initial browser run exposed a focus race after failed verification; the fix
focuses controls only after they have been re-enabled. A checkout-test timeout
under concurrent build/browser load was resolved by running the full suite with
two workers; the existing checkout test passed without changing its assertions.

## Files added

```text
app/api/dashboard/manager/registration-qr/route.ts
app/api/registration/[token]/route.ts
app/register/[token]/page.tsx
app/register/success/page.tsx
app/registration-complete/page.tsx
app/legal/[document]/page.tsx
components/manager/StoreRegistrationQR.tsx
components/registration/RegistrationForm.tsx
components/PublicTelemetry.tsx
lib/registration/image.ts
lib/registration/legal.ts
lib/registration/provider.ts
lib/registration/receipt.ts
lib/registration/store.ts
lib/registration/submit.ts
lib/registration/telemetry.ts
lib/registration/validation.ts
scripts/cleanup-registration-documents.mjs
scripts/test-qr-ui-harness.mjs
supabase/migrations/20261007130205_store_qr_customer_registration.sql
tests/unit/qr-registration-database.test.ts
tests/unit/qr-registration-image.test.ts
tests/unit/qr-registration-manager.test.ts
tests/unit/qr-registration-receipt.test.ts
tests/unit/qr-registration-route.test.ts
tests/unit/qr-registration-store.test.ts
tests/unit/qr-registration-submit.test.ts
tests/unit/qr-registration-success.test.tsx
tests/unit/qr-registration-validation.test.ts
tests/e2e/qr-registration-ui.spec.ts
tests/local/qr-ui.playwright.config.ts
docs/qr-registration.md
docs/qr-registration-report.md
```

## Existing files changed by this task

Some of these already had changes before this task; the list identifies files
touched here, rather than claiming ownership of their complete Git diff.

```text
.env.example
.env.production.example
.env.staging.example
README.md
app/layout.tsx
app/register/page.tsx
app/dashboard/manager/page.tsx
app/dashboard/receptionist/customers/register/page.tsx
components/TopBar.tsx
components/receptionist/pos/CustomerCheckoutDialog.tsx
lib/receptionist/customers.ts
proxy.ts
instrumentation-client.ts
sentry.server.config.ts
sentry.edge.config.ts
package.json
package-lock.json
playwright.config.ts
tests/unit/receptionist-customer-search.test.ts
```

## Before production activation

Apply the reviewed migration to the intended database; connect and approve a real
provider gateway; configure the server secrets and canonical HTTPS application
URL; approve the registration notices with real responsible-party contacts,
processor information and a customer/evidence/consent retention schedule; schedule
and monitor temporary-document cleanup. Set the approval variables only after
these controls are ready.

Run a real-provider smoke test against the intended database, verify immediate
receptionist search/sale linkage with two stores, and test camera/gallery/HEIC
support on actual iOS and Android devices. The desktop harness and isolated
database tests do not establish device/provider accuracy or target-database
migration state. Online customer-portal account/history access remains subject
to the existing separate verified account process; this public QR never grants
access to an existing person's account or purchase history.
