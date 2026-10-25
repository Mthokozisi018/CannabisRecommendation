import { beforeEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
const { staff, query, admin } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), single: vi.fn(), upsert: vi.fn() };
  return { query, staff: vi.fn(), admin: { from: vi.fn(() => query) } };
});
vi.mock("@/lib/dal/auth", () => ({ requireStaff: staff }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/app-url", () => ({ configuredApplicationUrl: () => "https://greenchoice.example.invalid" }));
import { GET } from "@/app/api/dashboard/manager/registration-qr/route";
import { GET as staffGET } from "@/app/api/dashboard/registration-qr/route";
import { StaffAuthenticationRequiredError } from "@/lib/auth-errors";
describe("manager permanent QR endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); staff.mockResolvedValue({ storeId: "store-a", storeAccessStatus: "active" });
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.upsert.mockResolvedValue({ error: null });
    query.single.mockImplementation(async () => query.select.mock.lastCall?.[0] === "name,is_active,store_access_status"
      ? { data: { name: "Store A", is_active: true, store_access_status: "active" }, error: null }
      : { data: { token: "a".repeat(64), revoked_at: null, expires_at: null }, error: null });
  });
  it("creates a real PNG QR from the assigned store's stable token", async () => {
    vi.stubEnv("QR_VERIFICATION_APPROVED", "false");
    vi.stubEnv("QR_VERIFICATION_URL", "");
    vi.stubEnv("QR_REGISTRATION_LEGAL_APPROVED", "");
    const first = await GET(); const one = await first.json(); const two = await (await GET()).json();
    expect(first.status).toBe(200); expect(one.link).toBe(`https://greenchoice.example.invalid/register/${"a".repeat(64)}`);
    expect(one.image).toMatch(/^data:image\/png;base64,/); expect(two.link).toBe(one.link); expect(two.image).toBe(one.image);
    expect(await sharp(Buffer.from(one.image.split(",")[1], "base64")).metadata()).toMatchObject({ width: 1024, height: 1536, format: "png" });
    expect(first.headers.get("Cache-Control")).toBe("private, no-store");
    expect(staff).toHaveBeenCalledWith(["manager"]);
    expect(query.eq).toHaveBeenCalledWith("id", "store-a"); expect(query.eq).toHaveBeenCalledWith("store_id", "store-a");
    expect(query.upsert).toHaveBeenCalledWith({ store_id: "store-a" }, { onConflict: "store_id", ignoreDuplicates: true });
    vi.unstubAllEnvs();
  });
  it("uses a different assigned store's token without accepting a browser-selected store", async () => {
    staff.mockResolvedValueOnce({ role: "receptionist", storeId: "store-b", storeAccessStatus: "active" });
    query.single.mockResolvedValueOnce({ data: { name: "Store B", is_active: true }, error: null })
      .mockResolvedValueOnce({ data: { token: "b".repeat(64), revoked_at: null, expires_at: null }, error: null });
    const body = await (await staffGET()).json();
    expect(body.storeName).toBe("Store B"); expect(body.link).toBe(`https://greenchoice.example.invalid/register/${"b".repeat(64)}`);
    expect(query.eq).toHaveBeenCalledWith("id", "store-b"); expect(query.eq).toHaveBeenCalledWith("store_id", "store-b");
  });
  it("returns an actionable error without an incomplete poster if QR rendering fails", async () => {
    const render = vi.spyOn(QRCode, "toBuffer").mockRejectedValueOnce(new Error("render failed"));
    try {
      const response = await GET(); expect(response.status).toBe(503);
      const body = await response.json(); expect(body.stage).toBe("qr-image-generation"); expect(body.image).toBeUndefined();
    } finally { render.mockRestore(); }
  });
  it("fails closed for unauthorized or restricted staff", async () => {
    staff.mockRejectedValueOnce(new Error("Not a manager")); expect((await GET()).status).toBe(403); expect(admin.from).not.toHaveBeenCalled();
    staff.mockResolvedValueOnce({ storeId: "store-a", storeAccessStatus: "restricted" }); expect((await GET()).status).toBe(403); expect(admin.from).not.toHaveBeenCalled();
  });
  it("returns the identical permanent poster for a manager and receptionist at the same store", async () => {
    staff.mockResolvedValueOnce({ role: "manager", storeId: "store-a", storeAccessStatus: "active" });
    const manager = await (await GET()).json();
    staff.mockResolvedValueOnce({ role: "receptionist", storeId: "store-a", storeAccessStatus: "active" });
    const receptionistResponse = await staffGET(); const receptionist = await receptionistResponse.json();
    expect(receptionistResponse.status).toBe(200); expect(receptionist).toEqual(manager);
    expect(staff).toHaveBeenLastCalledWith(["manager", "receptionist"]);
    expect(query.upsert).toHaveBeenLastCalledWith({ store_id: "store-a" }, { onConflict: "store_id", ignoreDuplicates: true });
  });
  it("rejects unauthenticated staff before any store data or token is accessed", async () => {
    staff.mockRejectedValueOnce(new StaffAuthenticationRequiredError());
    expect((await staffGET()).status).toBe(401); expect(admin.from).not.toHaveBeenCalled();
  });
  it("rejects forbidden roles and restricted receptionist accounts before database access", async () => {
    staff.mockImplementationOnce(async roles => { expect(roles).not.toContain("customer"); expect(roles).not.toContain("admin"); throw new Error("Insufficient staff role."); });
    expect((await staffGET()).status).toBe(403); expect(admin.from).not.toHaveBeenCalled();
    staff.mockResolvedValueOnce({ role: "receptionist", storeId: "store-a", storeAccessStatus: "restricted" });
    expect((await staffGET()).status).toBe(403); expect(admin.from).not.toHaveBeenCalled();
  });
  it("identifies the missing-token-schema failure instead of blaming image generation", async () => {
    query.upsert.mockResolvedValueOnce({ error: { code: "PGRST205", message: "internal database details" } });
    const result = await GET();
    expect(result.status).toBe(503);
    const body = await result.json();
    expect(body).toMatchObject({ code: "qr_schema_missing", stage: "token-provisioning" });
    expect(body.error).toContain("migration"); expect(JSON.stringify(body)).not.toContain("internal database details");
  });
  it("rejects missing store assignments", async () => {
    staff.mockResolvedValueOnce({ storeId: "", storeAccessStatus: "active" });
    expect((await GET()).status).toBe(409); expect(admin.from).not.toHaveBeenCalled();
  });
  it("does not return a poster when the stored registration token is missing", async () => {
    query.single.mockResolvedValueOnce({ data: { name: "Store A", is_active: true }, error: null })
      .mockResolvedValueOnce({ data: { token: null, revoked_at: null, expires_at: null }, error: null });
    const response = await GET(); expect(response.status).toBe(503);
    const body = await response.json(); expect(body.stage).toBe("registration-url"); expect(body.image).toBeUndefined();
  });
  it("does not silently reactivate or rotate revoked tokens", async () => {
    query.single.mockResolvedValueOnce({ data: { name: "Store A", is_active: true }, error: null })
      .mockResolvedValueOnce({ data: { token: "a".repeat(64), revoked_at: "2026-10-07", expires_at: null }, error: null });
    const response = await GET(); expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: "token_inactive" });
  });
});
