# Permanent store QR generation fix

The exact failure was token provisioning in
`GET /api/dashboard/manager/registration-qr`: staging returned **PGRST205**,
because `public.store_registration_tokens` did not exist. Store records and active
manager assignments existed. The request stopped before URL construction and
`QRCode.toDataURL()`; the previous catch block hid that distinction.

QR generation never called the OCR provider. The installed server-compatible
`qrcode@1.5.4` package generated valid PNG data URLs when supplied a valid link.
There was no QR package incompatibility or need for another package.

## Database repair

Applied `20261007134647_store_registration_qr_tokens.sql` to the configured,
validated **staging** project `jezbvjepxosphdrykrcg`. Production was not changed.
This small migration creates/provisions only permanent random registration tokens,
enables RLS, restricts access to the service role and reloads the REST schema cache.
It does not create customer/evidence records or configure OCR.

Verified three stores with three distinct tokens. Repeating provisioning did not
change any token. The earlier full registration migration now tolerates an existing
token table and preserves its rows, so applying it later will not rotate QR codes.
The new local migration filename matches the applied database migration version.

## Code changes

- `lib/registration/url.ts`: canonical `getStoreRegistrationUrl({ registrationToken })`
  uses the existing `APP_URL` / `NEXT_PUBLIC_APP_URL` resolution and current
  `/register/[token]` route. It rejects missing/invalid public identifiers and
  returns an absolute URL; no production domain or raw store ID is hardcoded.
- QR API: explicitly uses the Node runtime, retains authenticated manager/store
  isolation, checks store assignment, preserves revoked tokens, and reports
  missing-schema errors with an actionable migration message. Safe diagnostics
  include the failing stage, store ID and database error code, never credentials,
  customer data or full database error messages.
- `StoreRegistrationQR`: retains its small client boundary; shows loading store,
  generating QR, ready and error states; validates API link/image data before
  rendering; preserves server error messages; ignores stale closed-modal requests;
  adds retry and print alongside download/share/copy.
- Print-only CSS isolates the open QR modal from the dashboard.
- Regression tests cover URL construction, absent OCR/legal configuration,
  missing token schema, permanent provisioning, revoked/unassigned stores and
  modal image/download/copy/print/error behaviour.

The QR continues to point at `/register/[token]`, matching the implemented public
route. No `/register/store/...` route or duplicate registration system was added.

## Verification

Live staging queries confirmed the token table and RLS, three permanent unique
tokens, unchanged tokens after repeat provisioning, and real PNG generation.
Actual local HTTP requests to each generated registration URL returned **200** and
the matching store registration form for GreenChoice Sandton, Cloud 6 seven and
Cloud9, without OCR configuration.

The QR-focused unit/database suite passed 20 tests; nine mobile/browser harness
tests passed, including actual download initiation and controlled clipboard/print
actions. The full unit/security suite passed **389 tests** across 65 files;
typecheck, lint (one existing warning), validation of 66 migration files and
secret scanning passed.
Production compilation also passed (`npm run build:local`), including route
generation and TypeScript checks. The database test additionally proves that
applying QR-only setup before the full registration migration preserves the
permanent tokens.

Authenticated live manager-browser testing was unavailable because the
in-app browser connector failed and manager E2E credentials are not configured;
the API authorization boundary is tested with controlled manager sessions, and
the live database/registration destination checks use the real staging records.

For production, apply the same small token migration and configure the existing
canonical HTTPS application URL. OCR readiness still controls document checks
after upload; it never controls displaying or downloading the QR code.
