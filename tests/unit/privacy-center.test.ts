import { describe, expect, it } from "vitest";
import { canAccess } from "@/lib/authorization";
import { consentRecords, customerContext, privacyRequests } from "@/lib/account-data";

describe("privacy center model", () => {
  it("exposes concrete privacy request states and consent versions", () => {
    expect(privacyRequests.some((request) => request.type === "Data download")).toBe(true);
    expect(consentRecords.every((record) => record.version.length > 0)).toBe(true);
  });

  it("allows customers to manage only their own privacy center", () => {
    expect(canAccess(customerContext, "privacy.manage_self", { ownerUserId: customerContext.userId })).toBe(true);
    expect(canAccess(customerContext, "privacy.manage_self", { ownerUserId: "other-customer" })).toBe(false);
  });
});
