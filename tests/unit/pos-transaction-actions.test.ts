import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), readRpc: vi.fn(), staff: vi.fn(), origin: vi.fn(), rate: vi.fn(), revalidate: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/cache/redis", () => ({ invalidateStoreDisplayCache: mocks.invalidate }));
vi.mock("@/lib/dal/auth", () => ({ requireStaff: mocks.staff }));
vi.mock("@/lib/security", () => ({ verifyOrigin: mocks.origin, assertRateLimit: mocks.rate }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }), createSupabaseServerClient: async () => ({ rpc: mocks.readRpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { amendPOSTransactionAction, getPOSReceiptAction, searchPOSTransactionsAction } from "@/app/dashboard/receptionist/transactions";

const saleId = "11111111-1111-4111-8111-111111111111";
const input = { saleId, requestId: "22222222-2222-4222-8222-222222222222", version: 0, kind: "payment_correction", reason: "Wrong tender recorded", payment: { method: "cash", cashAmount: 300, cardAmount: 0 }, returnedExternally: false };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ id: "actor-from-session", storeId: "store-from-session", storeAccessStatus: "active" });
  mocks.origin.mockResolvedValue(undefined); mocks.rate.mockResolvedValue(undefined);
  mocks.rpc.mockResolvedValue({ error: null }); mocks.readRpc.mockResolvedValue({ data: { id: saleId }, error: null });
});
describe("POS transaction actions", () => {
  it("uses trusted actor/store identity, validates origin and refreshes reports after an amendment", async () => {
    expect((await amendPOSTransactionAction(input)).ok).toBe(true);
    expect(mocks.origin).toHaveBeenCalled();
    expect(mocks.staff).toHaveBeenCalledWith(["manager", "receptionist"]);
    expect(mocks.rpc).toHaveBeenCalledWith("amend_pos_transaction", expect.objectContaining({ p_actor_id: "actor-from-session", p_sale_id: saleId }));
    expect(mocks.readRpc).toHaveBeenCalledWith("get_pos_receipt", { p_sale_id: saleId, p_store_id: "store-from-session" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard/manager/sales");
    expect(mocks.invalidate).toHaveBeenCalledWith("store-from-session");
  });
  it("rejects spoofed identity fields, missing reasons, and unconfirmed refunds before the RPC", async () => {
    for (const bad of [{ ...input, actorId: "spoof" }, { ...input, reason: " " }, { ...input, kind: "refund" }]) expect((await amendPOSTransactionAction(bad)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps failed refunds out of report invalidations", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Provider reconciliation required." } });
    const result = await amendPOSTransactionAction({ ...input, kind: "refund", returnedExternally: true });
    expect(result).toEqual({ ok: false, message: "Provider reconciliation required." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("denies unauthenticated and restricted mutations", async () => {
    mocks.staff.mockRejectedValueOnce(new Error("Sign in required"));
    expect((await amendPOSTransactionAction(input)).ok).toBe(false);
    mocks.staff.mockResolvedValueOnce({ storeAccessStatus: "restricted" });
    expect((await amendPOSTransactionAction(input)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("scopes history and receipt reads to the assigned store", async () => {
    await searchPOSTransactionsAction({ search: "Alice", date: "2026-10-16", page: 1 });
    expect(mocks.readRpc).toHaveBeenCalledWith("search_pos_transactions", { p_store_id: "store-from-session", p_search: "Alice", p_date: "2026-10-16", p_offset: 20 });
    mocks.readRpc.mockResolvedValue({ data: null, error: null });
    expect((await getPOSReceiptAction(saleId)).ok).toBe(false);
  });
});
