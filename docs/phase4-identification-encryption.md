# Customer identification protection — Phase 4

## Implemented locally

- QR registration validates the supplied SA ID or passport and sends the processed image to an approved server-side verification provider. The full submitted number, OCR response and image are not retained in the customer database. The evidence table stores document type, last four characters, an HMAC-SHA256 fingerprint, age/match flags and consent records; it is service-role-only with RLS. The last four are partial plaintext and should be treated as sensitive.
- Temporary image objects are now encrypted before Storage upload with AES-256-GCM, a fresh 12-byte nonce, a 16-byte authentication tag and context binding to store, submission and object path. Storage receives ciphertext as `application/octet-stream`; provider verification still uses a transient server memory buffer. The server key is separate from the HMAC secret and Supabase credentials. Missing or malformed key fails registration before any file is queued or uploaded.
- `20261024120000_encrypt_temporary_registration_documents.sql` allows encrypted binary objects and legacy JPEGs in the existing private bucket. It changes no existing rows or object bytes. The legacy MIME type can be removed only after confirmed cleanup. The 6 MiB image limit plus 32 bytes of envelope overhead remains within the new bucket limit.
- Local tests cover encryption/decryption, fresh nonces, tamper and wrong-context rejection, missing-key failure, ciphertext upload, cleanup and a synthetic migration rehearsal. These are local results; no hosted object has been encrypted or restored by this work.

## Rollout order and dependencies

1. Reconcile remote migration histories and obtain a reviewed staging migration plan. Apply the bucket migration in staging only after deployment authorization and backup verification.
2. Provision an independent random 32-byte key in a server-only staging secret store as canonical base64; restrict read access to the application runtime and key custodians. Set `CUSTOMER_DOCUMENT_ENCRYPTION_KEY`. Keep `CUSTOMER_ID_HMAC_SECRET` independent. Do not copy keys between staging and production.
3. Deploy the matching application revision to staging, then test real registration with the approved provider. Download a synthetic test object through a privileged backend path in an isolated test or use an equivalent harness to verify ciphertext and decryption. Verify cleanup within the agreed one-hour window, failure retries, and no browser reads.
4. Confirm registration requests, error logs, OCR gateway logs and analytics do not record ID values, document bodies, tokens or decryption keys. Confirm the provider's retention and incident terms.
5. Inventory any existing long-lived customer ID or licence fields outside the QR registration path. This change protects the audited QR flow only. For any retained plaintext, design a separate additive ciphertext column, restricted backfill, dual-read window, validation, and reviewed plaintext removal. No destructive backfill is part of this change.

## Rotation, recovery and future access

- The current bucket is temporary, with no authorized document-viewing route. Rotate by pausing new registration, draining/deleting existing queued objects, confirming the bucket has no older encrypted objects, changing the managed key, then resuming. Keep the previous key protected until the drain is independently verified. If persistent document retention is introduced, first add an envelope key identifier and a managed keyring, with audited, store-scoped backend decryption.
- Back up the key outside Supabase and test recovery using synthetic ciphertext. A database or Storage restore without the corresponding key cannot recover encrypted objects. Loss of this key is a separate recovery event.
- The HMAC fingerprint supports equality checks without a searchable plaintext number, but the last four characters and metadata can still reveal information. Restrict privileged reads and exports; do not expose fingerprints to browsers. Rotation of the HMAC secret requires a separate reviewed migration because fingerprints cannot be recalculated from retained data.

## Release status

Application-level encryption for the temporary QR photo is implemented and locally tested. Full-number encryption is unnecessary in this path because full numbers are not persisted. The broader requirement for any other retained customer identification fields remains open until a full data inventory and authenticated staging verification are complete. This is a pre-commercial-launch gate, not evidence of full encryption coverage.
