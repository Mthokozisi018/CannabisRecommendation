import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { staffCreateSchema } from "@/lib/manager/validation";

vi.mock("server-only", () => ({}));

const originalSecret = process.env.GREENCHOICE_PASSWORD_FINGERPRINT_SECRET;

beforeEach(() => {
  process.env.GREENCHOICE_PASSWORD_FINGERPRINT_SECRET = "test-only-temporary-password-secret-1234567890";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.GREENCHOICE_PASSWORD_FINGERPRINT_SECRET;
  else process.env.GREENCHOICE_PASSWORD_FINGERPRINT_SECRET = originalSecret;
});

describe("receptionist password policies", () => {
  it("allows any non-empty manager-created temporary password", () => {
    const accepted = staffCreateSchema.safeParse({
      email: "receptionist@example.com",
      password: "1",
      confirmPassword: "1"
    });
    const empty = staffCreateSchema.safeParse({
      email: "receptionist@example.com",
      password: "",
      confirmPassword: ""
    });

    expect(accepted.success).toBe(true);
    expect(empty.success).toBe(false);
  });

  it("derives a strong server-only Supabase credential from the temporary password", async () => {
    const { managerCreatedTemporaryAuthPassword } = await import("@/lib/manager/temporary-password");
    const derived = managerCreatedTemporaryAuthPassword("Receptionist@Example.com", "1");

    expect(derived).toMatch(/^Gc1![a-f0-9]{64}$/);
    expect(derived).toBe(managerCreatedTemporaryAuthPassword("receptionist@example.com", "1"));
    expect(derived).not.toContain("receptionist@example.com");
  });

  it("retains the strong permanent-password policy used during onboarding", () => {
    expect(managerPasswordIssues("1", "1")).toContain("At least 12 characters");
    expect(managerPasswordIssues("SecureReceptionist1!", "SecureReceptionist1!")).toEqual([]);
  });
});
