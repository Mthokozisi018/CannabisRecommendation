import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizePOSCustomerPhone } from "@/lib/pos-customer-format";
import { registrationSchema, REGISTRATION_NOTICE_VERSION, type RegistrationInput } from "./validation";
import { configuredDocumentProvider, confirmDocument, VerificationError, type DocumentProvider } from "./provider";
import { internalDocumentProvider } from "./internal-document-reader";
import { prepareDocumentImage } from "./image";
import { resolveRegistrationStore } from "./store";
import { encryptRegistrationDocument } from "./document-encryption";

export class RegistrationError extends Error {
  constructor(message: string, public field = "documentNumber", public status = 400) { super(message); }
}
export class RegistrationServiceError extends VerificationError {
  constructor(public stage: "legal_approval" | "server_credentials" | "registration_lookup" | "provider_configuration" |
    "document_encryption" | "cleanup_queue" | "registration_audit" | "private_storage" | "document_reader" | "verification_gateway" | "database_commit") {
    super("unavailable");
  }
}
function digest(value: string | Buffer) {
  const key = process.env.CUSTOMER_ID_HMAC_SECRET;
  if (!key || key.length < 32) throw new VerificationError("unavailable");
  return createHmac("sha256", key).update(value).digest("hex");
}

export async function submitQRRegistration(token: string, input: RegistrationInput, file: File, provider?: DocumentProvider) {
  const parsed = registrationSchema.parse(input);
  const store = await resolveRegistrationStore(token);
  if (!store) throw new RegistrationError("This registration link is unavailable. Please ask the store for its current QR code.", "", 404);
  if (process.env.QR_REGISTRATION_LEGAL_APPROVED !== REGISTRATION_NOTICE_VERSION) throw new RegistrationServiceError("legal_approval");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new RegistrationServiceError("server_credentials");
  const phone = normalizePOSCustomerPhone(parsed.phoneNumber)!;
  const image = await prepareDocumentImage(file).catch(error => { throw new RegistrationError(error.message, "image"); });
  const hash = digest(JSON.stringify({ ...parsed, phoneNumber: phone.normalized, channels: parsed.marketing ? [...new Set(parsed.channels)].sort() : [], token, image: digest(image) }));
  // Check a previous atomic commit before invoking OCR again after a lost response.
  const previous = await admin.from("qr_customer_registrations").select("payload_hash, store_id").eq("id", parsed.submissionId).maybeSingle();
  if (previous.error) throw new RegistrationServiceError("registration_lookup");
  if (previous.data) {
    if (previous.data.payload_hash !== hash || previous.data.store_id !== store.id) throw new RegistrationError("This submission has changed. Please submit again.", "", 409);
    return { storeName: store.name, phoneDisplay: phone.display };
  }
  let reader: DocumentProvider;
  try { reader = provider ?? configuredDocumentProvider(); }
  catch { throw new RegistrationServiceError("provider_configuration"); }
  // Queue before upload so a process crash cannot leave an untracked file.
  const path = `${randomUUID()}.gcenc`;
  const encryptedImage = (() => {
    try { return encryptRegistrationDocument(image, `${store.id}:${parsed.submissionId}:${path}`); }
    catch { throw new RegistrationServiceError("document_encryption"); }
  })();
  const queued = await admin.from("qr_document_cleanup").insert({ path });
  if (queued.error) throw new RegistrationServiceError("cleanup_queue");
  try {
    const audited = await admin.from("qr_registration_audits").insert({ submission_id: parsed.submissionId, store_id: store.id, event: "document_check_requested" });
    if (audited.error) throw new RegistrationServiceError("registration_audit");
    const uploaded = await admin.storage.from("registration-documents").upload(path, encryptedImage, { contentType: "application/octet-stream", upsert: false });
    if (uploaded.error) throw new RegistrationServiceError("private_storage");
    let result;
    try { result = await reader.read(image, parsed.documentType, parsed.submissionId); }
    catch (error) {
      if (error instanceof VerificationError && error.code !== "unavailable") throw error;
      throw new RegistrationServiceError(reader === internalDocumentProvider ? "document_reader" : "verification_gateway");
    }
    const checks = confirmDocument(result, parsed.documentType, parsed.documentNumber);
    const saved = await admin.rpc("complete_qr_customer_registration", {
      p_token: token, p_submission_id: parsed.submissionId, p_payload_hash: hash,
      p_full_name: parsed.fullName, p_email: parsed.email,
      p_phone_normalized: phone.normalized, p_phone_digits: phone.digits, p_phone_display: phone.display,
      p_document_type: parsed.documentType,
      p_document_fingerprint: digest(`${parsed.documentType}:${parsed.documentNumber}`),
      p_document_last_four: parsed.documentNumber.slice(-4),
      p_number_matched: checks.numberMatched, p_age_confirmed: checks.ageConfirmed,
      p_accept_terms: parsed.acceptTerms, p_accept_privacy: parsed.acceptPrivacy, p_accept_verification: parsed.acceptVerification,
      p_notice_version: REGISTRATION_NOTICE_VERSION, p_marketing: parsed.marketing,
      p_channels: parsed.marketing ? [...new Set(parsed.channels)] : []
    });
    if (saved.error) {
      if (saved.error.code === "23505") throw new RegistrationError("We cannot complete this registration online. Please ask the store for assistance.", "phoneNumber", 409);
      // The transaction re-resolves and locks the active token/store.
      if (saved.error.code === "22023") throw new RegistrationError("Registration could not be completed. Please check the store link and your details.", "", 409);
      throw new RegistrationServiceError("database_commit");
    }
    return { storeName: store.name, phoneDisplay: phone.display };
  } finally {
    // Failure leaves the tracked path for the scheduled retry job. No raw provider result is stored.
    try {
      const removed = await admin.storage.from("registration-documents").remove([path]);
      await admin.from("qr_registration_audits").insert({ submission_id: parsed.submissionId, store_id: store.id, event: removed.error ? "document_delete_retry" : "document_deleted" });
      if (!removed.error) await admin.from("qr_document_cleanup").delete().eq("path", path);
    } catch { /* scheduled cleanup retries without logging sensitive payloads */ }
  }
}
