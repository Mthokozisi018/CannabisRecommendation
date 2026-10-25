import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { admin, query, storage, store, image } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), insert: vi.fn(), delete: vi.fn() };
  const storage = { upload: vi.fn(), remove: vi.fn() };
  return { query, storage, admin: { from: vi.fn(() => query), rpc: vi.fn(), storage: { from: vi.fn(() => storage) } }, store: vi.fn(), image: vi.fn() };
});
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/registration/store", () => ({ resolveRegistrationStore: store }));
vi.mock("@/lib/registration/image", () => ({ prepareDocumentImage: image }));
import { submitQRRegistration } from "@/lib/registration/submit";
import { decryptRegistrationDocument } from "@/lib/registration/document-encryption";
const input = { fullName: "Test Customer", email: "test@example.invalid", phoneNumber: "0821234567", documentType: "passport" as const, documentNumber: "A00123456", acceptTerms: true as const, acceptPrivacy: true as const, acceptVerification: true as const, marketing: false, channels: [], submissionId: "2df384f2-7b16-4b63-9d2d-4a7d8cbafbe2" };
const file = new File(["test"], "test.jpg");
describe("trusted registration orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CUSTOMER_ID_HMAC_SECRET", "test-secret-with-at-least-32-characters");
    vi.stubEnv("CUSTOMER_DOCUMENT_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    vi.stubEnv("QR_REGISTRATION_LEGAL_APPROVED", "2026-10-07");
    store.mockResolvedValue({ id: "store-a", name: "Store A" }); image.mockResolvedValue(Buffer.from("processed"));
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.maybeSingle.mockResolvedValue({ data: null, error: null });
    query.insert.mockResolvedValue({ error: null }); query.delete.mockReturnValue(query);
    storage.upload.mockResolvedValue({ error: null }); storage.remove.mockResolvedValue({ error: null }); admin.rpc.mockResolvedValue({ data: "customer", error: null });
  });
  it("commits only trusted checks using the token and deletes temporary evidence", async () => {
    const read = vi.fn().mockResolvedValue({ status: "read", documentType: "passport", documentNumber: "A00123456", dateOfBirth: "1990-01-01" });
    expect(await submitQRRegistration("token-a", input, file, { read })).toEqual({ storeName: "Store A", phoneDisplay: "082 123 4567" });
    expect(admin.rpc).toHaveBeenCalledWith("complete_qr_customer_registration", expect.objectContaining({ p_token: "token-a", p_number_matched: true, p_age_confirmed: true, p_channels: [], p_phone_normalized: "+27821234567" }));
    const payload = admin.rpc.mock.calls[0][1];
    expect(payload).not.toHaveProperty("store_id"); expect(JSON.stringify(payload)).not.toContain("A00123456");
    expect(storage.remove).toHaveBeenCalled(); expect(query.delete).toHaveBeenCalled();
    const [path, stored, options] = storage.upload.mock.calls[0];
    expect(path).toMatch(/\.gcenc$/);
    expect(options.contentType).toBe("application/octet-stream");
    expect(stored.includes(Buffer.from("processed"))).toBe(false);
    expect(decryptRegistrationDocument(stored, `store-a:${input.submissionId}:${path}`)).toEqual(Buffer.from("processed"));
  });
  it.each([
    { status: "unreadable", documentType: "passport" },
    { status: "read", documentType: "passport", documentNumber: "OTHER" },
    { status: "read", documentType: "passport", documentNumber: "A00123456" },
    { status: "read", documentType: "passport", documentNumber: "A00123456", dateOfBirth: "2020-01-01" },
    { status: "manual_review", documentType: "passport" }
  ])("never commits failed verification %#", async result => {
    await expect(submitQRRegistration("token-a", input, file, { read: vi.fn().mockResolvedValue(result) })).rejects.toThrow();
    expect(admin.rpc).not.toHaveBeenCalled(); expect(storage.remove).toHaveBeenCalled();
  });
  it("fails closed for invalid/inactive tokens before upload", async () => {
    store.mockResolvedValue(null);
    await expect(submitQRRegistration("invalid", input, file)).rejects.toThrow("link is unavailable");
    expect(storage.upload).not.toHaveBeenCalled(); expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("does not leak or merge duplicate customer information", async () => {
    admin.rpc.mockResolvedValue({ error: { code: "23505", message: "sensitive database details" } });
    await expect(submitQRRegistration("token-a", input, file, { read: vi.fn().mockResolvedValue({ status: "read", documentType: "passport", documentNumber: "A00123456", dateOfBirth: "1990-01-01" }) })).rejects.toThrow("ask the store for assistance");
  });
  it("leaves failed deletions queued for scheduled cleanup", async () => {
    storage.remove.mockResolvedValue({ error: { message: "offline" } });
    await expect(submitQRRegistration("token-a", input, file, { read: vi.fn().mockRejectedValue(new Error("provider unavailable")) })).rejects.toThrow();
    expect(query.delete).not.toHaveBeenCalled(); expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("requires approved configuration before storing documents", async () => {
    vi.stubEnv("QR_REGISTRATION_LEGAL_APPROVED", "");
    await expect(submitQRRegistration("token-a", input, file)).rejects.toThrow("temporarily unavailable");
    expect(storage.upload).not.toHaveBeenCalled(); expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("fails closed before queueing or uploading when the document key is absent", async () => {
    vi.stubEnv("CUSTOMER_DOCUMENT_ENCRYPTION_KEY", "");
    await expect(submitQRRegistration("token-a", input, file, { read: vi.fn() })).rejects.toThrow("temporarily unavailable");
    expect(query.insert).not.toHaveBeenCalled(); expect(storage.upload).not.toHaveBeenCalled();
  });
  it("rejects edits to a previously committed submission", async () => {
    query.maybeSingle.mockResolvedValue({ data: { store_id: "store-b", payload_hash: "other" }, error: null });
    await expect(submitQRRegistration("token-a", input, file)).rejects.toThrow("submission has changed");
    expect(storage.upload).not.toHaveBeenCalled(); expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("replays a matching committed request without repeating OCR or inserting a customer", async () => {
    const read = vi.fn().mockResolvedValue({ status: "read", documentType: "passport", documentNumber: "A00123456", dateOfBirth: "1990-01-01" });
    await submitQRRegistration("token-a", input, file, { read });
    const payloadHash = admin.rpc.mock.calls[0][1].p_payload_hash;
    query.maybeSingle.mockResolvedValue({ data: { store_id: "store-a", payload_hash: payloadHash }, error: null });
    await submitQRRegistration("token-a", input, file, { read });
    expect(read).toHaveBeenCalledTimes(1); expect(admin.rpc).toHaveBeenCalledTimes(1); expect(storage.upload).toHaveBeenCalledTimes(1);
  });
});
