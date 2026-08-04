import { describe, expect, it } from "vitest";
import { decideAccountAccess, managerLoginDestination, type AccountFlowProfile } from "@/lib/account-flow";

const activeManager: AccountFlowProfile = {
  role: "manager",
  account_status: "active",
  is_active: true,
  store_id: null,
  stores: null
};

describe("manager invitation and onboarding account states", () => {
  it("allows an active newly invited manager without a store to enter onboarding", () => {
    expect(decideAccountAccess(activeManager)).toEqual({ allowed: true });
    expect(managerLoginDestination({
      accountSetupComplete: false,
      storeSetupComplete: false,
      onboardingCompleteSeen: false
    })).toBe("/manager/setup/account");
  });

  it("returns an interrupted manager to the exact incomplete onboarding step", () => {
    expect(managerLoginDestination({
      accountSetupComplete: true,
      storeSetupComplete: false,
      onboardingCompleteSeen: false
    })).toBe("/manager/setup/store");
    expect(managerLoginDestination({
      accountSetupComplete: true,
      storeSetupComplete: true,
      onboardingCompleteSeen: false
    })).toBe("/manager/setup/complete");
  });

  it("allows the manager dashboard only after all onboarding steps are complete", () => {
    expect(managerLoginDestination({
      accountSetupComplete: true,
      storeSetupComplete: true,
      onboardingCompleteSeen: true
    })).toBe("/dashboard/manager");
  });

  it("does not confuse deliberate account restriction with incomplete onboarding", () => {
    expect(decideAccountAccess({ ...activeManager, account_status: "restricted" })).toMatchObject({
      allowed: false,
      reason: "account_restricted"
    });
    expect(decideAccountAccess({ ...activeManager, store_id: "store-1", stores: { store_access_status: "restricted" } })).toMatchObject({
      allowed: false,
      reason: "store_restricted"
    });
  });

  it("still rejects an unassigned receptionist", () => {
    expect(decideAccountAccess({
      role: "receptionist",
      account_status: "active",
      is_active: true,
      store_id: null
    })).toMatchObject({ allowed: false, reason: "store_unassigned" });
  });
});
