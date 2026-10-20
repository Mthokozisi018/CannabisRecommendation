import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { query, results, admin } = vi.hoisted(() => {
  const results: Array<{ data: unknown; error: unknown }> = [];
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => results.shift()) };
  const admin = { from: vi.fn(() => query) }; return { query, results, admin };
});
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: () => admin }));
import { resolveRegistrationStore } from "@/lib/registration/store";
describe("server token resolution", () => {
  beforeEach(() => { vi.clearAllMocks(); results.length = 0; query.select.mockReturnValue(query); query.eq.mockReturnValue(query); });
  it("does not query malformed tokens", async () => { expect(await resolveRegistrationStore("raw-store-id")).toBeNull(); expect(admin.from).not.toHaveBeenCalled(); });
  it("resolves only the token's active store", async () => {
    results.push({ data: { store_id: "store-a", revoked_at: null, expires_at: null }, error: null }, { data: { id: "store-a", name: "Store A", is_active: true, store_access_status: "active" }, error: null });
    expect(await resolveRegistrationStore("a".repeat(64))).toEqual({ id: "store-a", name: "Store A" }); expect(query.eq).toHaveBeenCalledWith("id", "store-a");
  });
  it.each([{ revoked_at: "2026-01-01" }, { expires_at: "2000-01-01" }])("blocks revoked and expired tokens %#", async value => {
    results.push({ data: { store_id: "store-a", ...value }, error: null }); expect(await resolveRegistrationStore("a".repeat(64))).toBeNull(); expect(admin.from).toHaveBeenCalledTimes(1);
  });
  it.each([{ is_active: false }, { is_active: true, store_access_status: "restricted" }])("blocks inactive and restricted stores %#", async value => {
    results.push({ data: { store_id: "store-a" }, error: null }, { data: { id: "store-a", name: "Store A", ...value }, error: null }); expect(await resolveRegistrationStore("a".repeat(64))).toBeNull();
  });
});
