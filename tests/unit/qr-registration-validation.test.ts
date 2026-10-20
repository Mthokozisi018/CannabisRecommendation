import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ageAt, documentNumberError, luhnValid, maskPhone, registrationSchema } from "@/lib/registration/validation";
import { confirmDocument, configuredDocumentProvider } from "@/lib/registration/provider";

function idFor(prefix: string) {
  for (let digit = 0; digit < 10; digit++) if (luhnValid(prefix + digit)) return prefix + digit;
  throw new Error("Invalid test ID prefix");
}
const id = idFor("900101500908");
const input = { fullName: "Test Customer", email: "test@example.invalid", phoneNumber: "0821234567", documentType: "sa_id", documentNumber: id, acceptTerms: true, acceptPrivacy: true, acceptVerification: true, marketing: false, channels: [], submissionId: "2df384f2-7b16-4b63-9d2d-4a7d8cbafbe2" };
describe("store QR registration validation", () => {
  it("accepts no marketing and preserves number strings", () => { expect(registrationSchema.parse(input).marketing).toBe(false); expect(typeof registrationSchema.parse(input).documentNumber).toBe("string"); });
  it.each(["acceptTerms", "acceptPrivacy", "acceptVerification"])("requires active %s acknowledgement", key => { expect(registrationSchema.safeParse({ ...input, [key]: false }).success).toBe(false); });
  it.each(["store_id", "storeId", "verified", "ageConfirmed"])("rejects forged %s", key => { expect(registrationSchema.safeParse({ ...input, [key]: true }).success).toBe(false); });
  it("requires a channel only when marketing is selected", () => { expect(registrationSchema.safeParse({ ...input, marketing: true }).success).toBe(false); expect(registrationSchema.safeParse({ ...input, marketing: true, channels: ["sms"] }).success).toBe(true); });
  it("validates checksum, real dates and passport format separately", () => {
    expect(documentNumberError("sa_id", id)).toBeNull();
    expect(documentNumberError("sa_id", id.slice(0, 12) + ((Number(id[12]) + 1) % 10))).not.toBeNull();
    expect(documentNumberError("sa_id", idFor("900230500908"))).not.toBeNull();
    expect(documentNumberError("passport", "A00123456")).toBeNull();
    expect(documentNumberError("passport", "!!!")).not.toBeNull();
  });
  it("uses full provider birth dates to resolve an ambiguous SA ID century", () => {
    const ambiguous = idFor("260101500908");
    expect(() => confirmDocument({ status: "read", documentType: "sa_id", documentNumber: ambiguous, dateOfBirth: "2026-01-01" }, "sa_id", ambiguous, "2026-10-07")).toThrow("at least 18");
    expect(confirmDocument({ status: "read", documentType: "sa_id", documentNumber: ambiguous, dateOfBirth: "1926-01-01" }, "sa_id", ambiguous, "2026-10-07").ageConfirmed).toBe(true);
  });
  it("handles birthdays and invalid dates", () => {
    expect(ageAt("2008-10-08", "2026-10-07")).toBe(17);
    expect(ageAt("2008-10-07", "2026-10-07")).toBe(18);
    expect(ageAt("2008-02-30", "2026-10-07")).toBeNull();
    expect(ageAt("2027-01-01", "2026-10-07")).toBeNull();
  });
  it.each([
    [{ status: "unreadable", documentType: "sa_id" }, "read the document"],
    [{ status: "manual_review", documentType: "sa_id" }, "Manual review"],
    [{ status: "read", documentType: "sa_id", documentNumber: "wrong" }, "does not match"],
    [{ status: "read", documentType: "sa_id", documentNumber: id }, "confirm your age"],
    [{ status: "read", documentType: "sa_id", documentNumber: id, dateOfBirth: "1989-01-01" }, "confirm your age"]
  ] as const)("blocks inconclusive checks %#", (result, message) => { expect(() => confirmDocument(result, "sa_id", id)).toThrow(message); });
  it("requires a real approved provider", () => {
    vi.stubEnv("QR_VERIFICATION_APPROVED", "false");
    expect(configuredDocumentProvider).toThrow("temporarily unavailable");
    vi.unstubAllEnvs();
  });
  it("checks passport age with the provider DOB without applying Luhn", () => {
    expect(confirmDocument({ status: "read", documentType: "passport", documentNumber: "A00123456", dateOfBirth: "1990-01-01" }, "passport", "A00123456").numberMatched).toBe(true);
  });
  it("masks the national cellphone number", () => expect(maskPhone("082 123 4567")).toBe("082 *** 4567"));
});
