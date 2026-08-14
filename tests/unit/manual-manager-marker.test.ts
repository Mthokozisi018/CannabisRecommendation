import { describe, expect, it } from "vitest";
import { hasManualManagerMarker } from "@/lib/manual-manager-marker";

describe("manual manager app metadata", () => {
  it("requires both trusted manager markers", () => {
    expect(hasManualManagerMarker({
      greenchoice_role: "manager",
      greenchoice_registration: "manual"
    })).toBe(true);
    expect(hasManualManagerMarker({ greenchoice_role: "manager" })).toBe(false);
    expect(hasManualManagerMarker({ greenchoice_registration: "manual" })).toBe(false);
  });

  it("does not recognize admin, receptionist, unknown, or user-metadata-shaped values", () => {
    expect(hasManualManagerMarker({ greenchoice_role: "admin", greenchoice_registration: "manual" })).toBe(false);
    expect(hasManualManagerMarker({ greenchoice_role: "receptionist", greenchoice_registration: "manual" })).toBe(false);
    expect(hasManualManagerMarker({ invited_role: "manager" })).toBe(false);
    expect(hasManualManagerMarker(undefined)).toBe(false);
  });
});
