import { describe, expect, it } from "vitest";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { staffCreateSchema, temporaryPasswordIssues } from "@/lib/manager/validation";
import { staffAssignmentSchema, staffCreateSchema as franchiseAdminCreateSchema } from "@/lib/franchise/validation";

describe("manager-created receptionist temporary passwords", () => {
  it.each(["password", "manager", "123456", "welcome123", "greenchoice", "ABCDEF"])("accepts %s when the provider allows it", password => {
    const result = staffCreateSchema.safeParse({
      email: "new.receptionist@example.com",
      password,
      confirmPassword: password
    });
    expect(result.success).toBe(true);
    expect(temporaryPasswordIssues(password, password)).toEqual([]);
  });

  it("requires a temporary password", () => {
    expect(staffCreateSchema.safeParse({ email: "new.receptionist@example.com", password: "", confirmPassword: "" }).success).toBe(false);
    expect(temporaryPasswordIssues("", "")).toContain("Enter a temporary password.");
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

describe("franchise staff temporary passwords", () => {
  it.each(["manager", "receptionist"] as const)("accepts simple %s passwords", role => {
    for (const password of ["manager", "123456", "ABCDEF"]) {
      expect(staffAssignmentSchema.safeParse({ role, email: "staff@example.com", password }).success).toBe(true);
    }
  });

  it("keeps franchise administrator temporary credentials separate from permanent rules", () => {
    const base = { firstName: "Franchise", surname: "Admin", phone: "0821234567", email: "fa@example.com" };
    expect(franchiseAdminCreateSchema.safeParse({ ...base, password: "123456", confirmPassword: "123456" }).success).toBe(true);
    expect(franchiseAdminCreateSchema.safeParse({ ...base, password: "", confirmPassword: "" }).success).toBe(false);
    expect(franchiseAdminCreateSchema.safeParse({ ...base, password: "manager", confirmPassword: "different" }).success).toBe(false);
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
