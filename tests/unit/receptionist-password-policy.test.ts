import { describe, expect, it } from "vitest";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { staffCreateSchema } from "@/lib/manager/validation";

describe("receptionist password policies", () => {
  it("allows any character combination for a manager-created temporary password", () => {
    const accepted = staffCreateSchema.safeParse({
      email: "receptionist@example.com",
      password: "123456",
      confirmPassword: "123456"
    });
    const tooShort = staffCreateSchema.safeParse({
      email: "receptionist@example.com",
      password: "12345",
      confirmPassword: "12345"
    });

    expect(accepted.success).toBe(true);
    expect(tooShort.success).toBe(false);
  });

  it("retains the strong permanent-password policy used during onboarding", () => {
    expect(managerPasswordIssues("123456", "123456")).toContain("At least 12 characters");
    expect(managerPasswordIssues("SecureReceptionist1!", "SecureReceptionist1!")).toEqual([]);
  });
});
