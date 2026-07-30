import { describe, expect, it } from "vitest";
import { assertStoreMatch, requireAssignedStoreId } from "@/lib/store-scope";

describe("store scope helpers", () => {
  it("requires an assigned store instead of falling back to the platform store", () => {
    expect(() => requireAssignedStoreId({ store_id: null }, "Manager")).toThrow(/store assignment is required/);
    expect(requireAssignedStoreId({ store_id: "30000000-0000-4000-8000-000000000001" }, "Manager")).toBe("30000000-0000-4000-8000-000000000001");
  });

  it("rejects cross-store records", () => {
    expect(() => assertStoreMatch("store-b", "store-a")).toThrow(/denied/);
    expect(() => assertStoreMatch("store-a", "store-a")).not.toThrow();
  });
});
