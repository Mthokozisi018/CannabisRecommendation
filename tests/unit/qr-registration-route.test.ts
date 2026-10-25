import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { origin, limit, submit } = vi.hoisted(() => ({ origin: vi.fn(), limit: vi.fn(), submit: vi.fn() }));
vi.mock("@/lib/security", () => ({ verifyOrigin: origin }));
vi.mock("@/lib/rate-limit", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/rate-limit")>(), requireRateLimit: limit }));
vi.mock("@/lib/registration/submit", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/registration/submit")>(), submitQRRegistration: submit }));
import { POST } from "@/app/api/registration/[token]/route";
import { RateLimitExceededError } from "@/lib/rate-limit";
import { VerificationError } from "@/lib/registration/provider";

const input = { fullName: "Test Customer", email: "test@example.invalid", phoneNumber: "0821234567", documentType: "passport", documentNumber: "A00123456", acceptTerms: true, acceptPrivacy: true, acceptVerification: true, marketing: false, channels: [], submissionId: "2df384f2-7b16-4b63-9d2d-4a7d8cbafbe2" };
const token = "a".repeat(64);
const context = { params: Promise.resolve({ token }) };
function request(details: unknown = input, extra?: string) {
  const body = new FormData(); body.set("details", JSON.stringify(details)); body.set("image", new File(["synthetic"], "id.jpg")); if (extra) body.set(extra, "forged");
  return new Request(`http://localhost:3001/api/registration/${token}`, { method: "POST", body, headers: { origin: "http://localhost:3001" } });
}
describe("public store registration request boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SESSION_SIGNING_SECRET", "test-secret-with-at-least-32-characters"); origin.mockResolvedValue(true); limit.mockResolvedValue({ allowed: true }); submit.mockResolvedValue({ storeName: "Store A", phoneDisplay: "082 123 4567" }); });
  it("uses only route token and server verification and returns a private masked receipt", async () => {
    const result = await POST(request(), context);
    expect(result.status).toBe(201); expect(submit).toHaveBeenCalledWith(token, input, expect.any(File));
    expect(await result.json()).toMatchObject({ redirectTo: "/register/success" });
    expect(result.headers.get("cache-control")).toContain("no-store");
    const cookie = result.headers.get("set-cookie")!; expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("SameSite=strict"); expect(cookie).not.toContain("0821234567");
  });
  it.each(["verified", "store_id", "storeId", "ageConfirmed"])("rejects forged JSON field %s", async key => {
    expect((await POST(request({ ...input, [key]: true }), context)).status).toBe(400); expect(submit).not.toHaveBeenCalled();
  });
  it("rejects extra multipart fields", async () => { expect((await POST(request(input, "store_id"), context)).status).toBe(400); expect(submit).not.toHaveBeenCalled(); });
  it("checks origin and rate limit before processing upload", async () => {
    origin.mockRejectedValueOnce(new Error("untrusted origin")); expect((await POST(request(), context)).status).toBe(403); expect(limit).not.toHaveBeenCalled();
    limit.mockRejectedValueOnce(new RateLimitExceededError({ allowed: false, limit: 10, remaining: 0, retryAfterSeconds: 60, resetAt: Date.now() + 60_000 }));
    expect((await POST(request(), context)).status).toBe(429); expect(submit).not.toHaveBeenCalled();
    expect(limit).toHaveBeenCalledWith(expect.objectContaining({ namespace: "store-qr-register-ip", limit: 10 }));
  });
  it("limits chunked request bodies without trusting Content-Length", async () => {
    const body = new Uint8Array(6 * 1024 * 1024 + 32769);
    const oversized = new Request("http://localhost:3001/api/registration/test", { method: "POST", body, headers: { "Content-Type": "multipart/form-data; boundary=test" } });
    expect((await POST(oversized, context)).status).toBe(413); expect(submit).not.toHaveBeenCalled();
  });
  it("returns an accurate unavailable state with no provider or raw errors", async () => {
    submit.mockRejectedValueOnce(new VerificationError("unavailable")); const result = await POST(request(), context);
    expect(result.status).toBe(503); expect(await result.json()).toMatchObject({ code: "unavailable" });
    submit.mockRejectedValueOnce(new Error("sensitive OCR passport A00123456")); const safe = await POST(request(), context);
    expect(JSON.stringify(await safe.json())).not.toContain("A00123456");
  });
});
