import { describe, expect, it } from "vitest";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { staffCreateSchema, temporaryPasswordIssues } from "@/lib/manager/validation";

describe("manager-created receptionist temporary passwords", () => {
  it("accepts a 10-character temporary password without special characters", () => {
    const result = staffCreateSchema.safeParse({
      email: "new.receptionist@example.com",
      password: "abcdefghij",
      confirmPassword: "abcdefghij"
    });

    expect(result.success).toBe(true);
    expect(temporaryPasswordIssues("abcdefghij", "abcdefghij")).toEqual([]);
  });

  it("rejects a 9-character temporary password", () => {
    const result = staffCreateSchema.safeParse({
      email: "new.receptionist@example.com",
      password: "abcdefghi",
      confirmPassword: "abcdefghi"
    });

    expect(result.success).toBe(false);
    expect(temporaryPasswordIssues("abcdefghi", "abcdefghi")).toContain("Temporary password must be at least 10 characters.");
  });

  it("keeps special characters optional for temporary passwords", () => {
    expect(temporaryPasswordIssues("Abcdef1234", "Abcdef1234")).toEqual([]);
    expect(temporaryPasswordIssues("Abcdef123!", "Abcdef123!")).toEqual([]);
  });

  it("requires temporary password confirmation to match", () => {
    const result = staffCreateSchema.safeParse({
      email: "new.receptionist@example.com",
      password: "abcdefghij",
      confirmPassword: "abcdefghiJ"
    });

    expect(result.success).toBe(false);
    expect(temporaryPasswordIssues("abcdefghij", "abcdefghiJ")).toContain("Passwords must match");
  });
});

describe("receptionist permanent onboarding passwords", () => {
  it("still require length, uppercase, lowercase, number, and special character", () => {
    expect(managerPasswordIssues("Abcdef12345!", "Abcdef12345!")).toEqual([]);
    expect(managerPasswordIssues("Abcdef1234!", "Abcdef1234!")).toContain("At least 12 characters");
    expect(managerPasswordIssues("abcdef12345!", "abcdef12345!")).toContain("At least 1 uppercase letter");
    expect(managerPasswordIssues("ABCDEF12345!", "ABCDEF12345!")).toContain("At least 1 lowercase letter");
    expect(managerPasswordIssues("Abcdefghijk!", "Abcdefghijk!")).toContain("At least 1 number");
    expect(managerPasswordIssues("Abcdef123456", "Abcdef123456")).toContain("At least 1 special character");
  });
});
