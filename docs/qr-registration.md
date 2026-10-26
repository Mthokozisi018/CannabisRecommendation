# Store QR customer registration

This flow registers a store-scoped POS customer in the existing `pos_customers`
model. It does not create a Supabase Auth account or silently merge a public
request into an existing customer. The existing sale references and store-scoped
sales reports continue to use this record. Online customer-portal account linking
requires a separate verified account process; a phone number alone never grants
access to history.

## Migration and operation

Apply `supabase/migrations/20261007130205_store_qr_customer_registration.sql`
to the intended environment after reviewing the migration. No remote database is
changed by writing this file. Existing stores get permanent 256-bit random tokens;
new stores get their token once when an authorised manager or receptionist opens
QR Code or Register Customer.
Tokens, evidence, consent records and cleanup paths are service-role-only, with
RLS enabled and no browser grants. Staff retain the existing store-membership
policy on `pos_customers`, which contains no document evidence.

An authorised database administrator can revoke a token by setting `revoked_at`
or deliberately rotate it by updating `token` to a new
`encode(gen_random_bytes(32), 'hex')` value, clearing revocation/expiry as intended.
Record the administrator, store, reason and time in your existing administrative
audit process. Managers and receptionists cannot rotate or access another store's token from this
UI. Normal QR URLs have no expiration; the optional expiry column supports
deliberately time-limited links. A transaction locks and resolves the token and
active store again, so revocation cannot be bypassed by modifying browser data.

The atomic service-role-only RPC creates the POS customer and registration
evidence together. A request UUID plus HMAC of the complete canonical request and
decoded image provides idempotent replay. Reusing that UUID with changed details
is rejected. Existing phone records (including deleted ones) receive a generic
assistance message; no name, account or history is disclosed or changed. A sale
trigger additionally rejects cross-store customer references. Existing checkout
RPCs resolve active staff/store and enforce customer membership.

## Required environment

Existing Supabase server credentials, application URL, approved origin and shared
rate-limit configuration remain required. Add server-only values:

- The bundled server-side document reader is used when all `QR_VERIFICATION_*` values are absent. It reads the document number and full birth date locally. Unreadable or inconclusive images fail closed. The image is never sent to a third-party OCR service in this mode.
- An optional approved external gateway can be selected with `QR_VERIFICATION_URL` (HTTPS), `QR_VERIFICATION_API_KEY` (server-only), and `QR_VERIFICATION_APPROVED=true` after integration validation. A partially configured gateway fails closed.
- `CUSTOMER_ID_HMAC_SECRET`: at least 32 random characters; protects document fingerprints and request hashes.
- `CUSTOMER_DOCUMENT_ENCRYPTION_KEY`: an independent 32-byte random key encoded as canonical base64, held in server-only secret management. Never reuse the HMAC secret or expose this key to the browser.
- `SESSION_SIGNING_SECRET`: at least 32 random characters; signs short-lived success cookies.
- `QR_REGISTRATION_LEGAL_APPROVED=2026-10-07`: only after the registration notices have been reviewed and approved, including the responsible-party contact, processor details and customer-record retention schedule.

There is no production success mock or browser-supplied verification switch.
Missing legal/secrets configuration fails closed. Email is required,
matching the existing customer-registration rule. Minimum age remains 18.

## Optional approved provider gateway contract

POST multipart fields `documentType` (`sa_id` or `passport`) and `image` (sanitised
JPEG). The server sends `Authorization: Bearer ...` and `Idempotency-Key` with
the request UUID. The gateway must protect the credential, implement idempotency,
and return a JSON object of at most 4096 bytes:

```json
{
  "status": "read",
  "documentType": "passport",
  "documentNumber": "A00123456",
  "dateOfBirth": "1990-01-01"
}
```

The other supported statuses are `unreadable` and `manual_review`; they must not
be treated as successful registration. Only these limited fields are accepted.
Missing or inconsistent DOB blocks registration. For SA IDs, the full DOB must
agree with YYMMDD, resolving the century without assuming adulthood. Age is
evaluated on the Johannesburg calendar date. Passport numbers are strings of
5–20 alphanumeric characters and do not use the SA ID checksum. This adapter
reports number match and age confirmation, not document authenticity or rightful
ownership verification. If selecting an external provider, test its accuracy,
availability, processor agreement and data retention before enabling it.

## Images, privacy and cleanup

Upload content is bounded even for chunked requests. Sharp decodes real pixels,
rejects SVG/GIF/animated/invalid/oversized inputs, enforces a pixel limit, applies
EXIF orientation, strips metadata and produces JPEG. HEIC depends on the host's
Sharp/libvips codec support; unsupported input gets a clear retake/replace error.
On-device capture and gallery behaviour also require testing on actual iOS and
Android devices; desktop automation checks the distinct input attributes.

The private `registration-documents` bucket has no browser access and a
restrictive policy preventing broad existing storage policies from granting it.
New uploads are AES-256-GCM ciphertext with a random 96-bit nonce, 128-bit tag and
store/submission/path associated data. The application encrypts before uploading;
the bundled reader uses the server's transient processed image buffer. The
bucket's binary-object migration must be applied before enabling this code.
Older temporary JPEG objects are still accepted by the bucket during cleanup and
must be drained before the JPEG MIME type can be removed. No document URL or signed URL is sent to the browser or provider; bytes are sent
from the server. No document-review or override UI is introduced: public manual
review never creates an active customer. If adding review later, enforce an
approved reviewer role, short-lived access and sensitive-access/override audits.
Automated document-processing access and deletion/retry events are recorded in
`qr_registration_audits`, with store, submission, purpose and time only. No raw
document or OCR content is included. No verification override endpoint exists.

Images are deleted in `finally` on success and failure. A cleanup path is inserted
before upload so a crash cannot leave an untracked object. Schedule
`node scripts/cleanup-registration-documents.mjs` every 15 minutes using the
server environment; it deletes queued objects older than one hour through the
Storage API, retries failed removals and logs counts only. Monitor failed runs and
queue age/backlog. The policy's one-hour target requires this operational job.
Raw OCR and full document numbers are never persisted. Only a keyed fingerprint,
last four characters, document type, match/age status, time and consent versions
are retained in a server-only table. Set and implement the approved retention
schedule for these registration/consent records before production activation.

Public registration is excluded from analytics/speed insights and Sentry events
and transactions. Session replay is disabled globally to prevent recording these
forms after a client navigation. No sensitive values are added to URLs. Request
and provider errors are returned as safe fixed messages without payload logging.
Configure infrastructure/access logs to avoid request-body collection and token
logging as well. Public submissions enforce origin checks and the existing shared
rate limiter before parsing the image, independent of browser-chosen phone/token.

## UI and search

### Manager registration poster

The shared staff QR endpoint returns a complete lossless 1024 × 1536 PNG using
`public/branding/greenchoice-registration-template.png`, copied unchanged from
the supplied registration artwork. `lib/registration/poster.ts` uses the existing
QRCode and Sharp dependencies to centre the real assigned-store link at pixel
(512, 776). The measured white opening is x=318..706, y=591..961. QR output is
at most 350 pixels wide, with integer pixels per module and a four-module white
quiet zone; the botanical border and all other artwork remain unchanged.

The existing authorization, permanent token provisioning and configured
application origin are reused. No customer registration or POS lookup behavior
changes. The template is explicitly included in the endpoint's deployment file
trace. Missing templates, invalid URLs and generation failures return the existing
safe error response with no incomplete image.

The responsive dialog displays the composed PNG at up to 360 pixels wide, keeps
at least 288 pixels where the viewport permits, and scrolls on short screens.
Download, share and A4 portrait print all use that same PNG. Download filenames
are `GreenChoice-[StoreName]-Registration-QR.png`, with invalid filename characters
replaced. Download and print are disabled until the image loads; image errors
remove the poster and offer Retry. Closing clears the previous store poster.
Print uses a body-level portal, a white A4 page with 10mm margins and a centred
184 × 276mm poster; dashboard and dialog controls are removed from print layout.

Unit tests check store isolation, stable URLs, failure responses, template pixel
preservation, precise QR modules and white padding. The isolated UI suite uses
the actual server poster composer and checks responsive previews, the identical
downloaded PNG, print-only output and retry. Physical phone/printer checks and a
live target-store registration smoke test remain separate from synthetic tests.

`/register/[token]` is public and bypasses the retired legacy registration redirect.
It has one mobile page with Your Details, Verify Your Document and Agreements.
Legal links open exact documents/sections in a native full-screen dialog; inputs,
image and scroll position remain in the mounted form. All boxes start unticked.
Promotional consent is optional and stored with this store and selected channels.
The success page uses a signed 15-minute HttpOnly cookie with only the store name
and masked cellphone number. Done goes to a public completion page.

Phone lookup always queries the store-scoped database, so an unprocessed
Elasticsearch outbox cannot hide a newly committed customer. Name lookup retains
the existing index and store-scoped hydration. Search results do not contain
document evidence. Receptionists can use the same customer ID in existing POS
checkout; completed sales retain both store and customer references.
The POS phone-result cache is bypassed as well. The previous manual registration
action still fails closed. Assisted registration now uses the same verified form
and submission endpoint as customer self-registration, so staff cannot create an
unverified customer using an older client.

### Receptionist onboarding

`/api/dashboard/registration-qr` allows active managers and receptionists and
derives the store exclusively from the authenticated staff session. The previous
manager endpoint remains a manager-only compatibility route. Both delegate to
`lib/registration/staff-qr.ts`, reuse the same permanent store token and return the
same composed PNG. Restricted stores and inactive/revoked links fail closed.

The receptionist dashboard and checkout's Select Customer section both provide
Register Customer and QR Code. QR Code reuses the poster preview, download and
A4 print layout. Register Customer opens the existing RegistrationForm, with
the same validation, document capture/upload, identity checks and unticked
customer agreements; the legacy unverified creation action is not re-enabled.
The form cannot be dismissed while submitting. Closing or completing it unmounts
the document form and revokes its preview URL. Public self-registration continues
to redirect to its confirmation page; assisted registration stays in the POS,
preserves the cart and searches the newly registered cellphone number. Repeating
a previously empty phone search performs a fresh lookup before linking to a sale.

## Verification boundaries

See tests under `tests/unit/qr-registration-*`, the isolated PostgreSQL migration
tests and `tests/e2e/qr-registration-ui.spec.ts`. The UI harness renders the real
component with synthetic store details and controlled API responses; it is not a
production route or fake provider. A real provider/device/target-database smoke
test remains an activation requirement when those dependencies are configured.

Run `npm run test:qr-ui` for the isolated mobile browser suite. The normal E2E
configuration excludes that suite because it uses a separate synthetic harness.
