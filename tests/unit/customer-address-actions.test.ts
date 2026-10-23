import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ origin: vi.fn(), session: vi.fn(), client: vi.fn(), add: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/security", () => ({ verifyOrigin: mocks.origin }));
vi.mock("@/lib/customer/auth", () => ({ requireCustomerSession: mocks.session }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/app/customer/actions", () => ({ addCustomerAddressAction: mocks.add }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { deleteCustomerAddressAction, saveCustomerAddressAction, setDefaultCustomerAddressAction } from "@/app/customer/addresses/actions";

const id = "00000000-0000-4000-8000-000000000001";
function addressForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ addressId: id, label: "Home", streetAddress: "1 Test Street", unitDetails: "", suburb: "Test", city: "Pretoria", province: "Gauteng", postalCode: "0001" })) form.set(key, value);
  return form;
}
describe("address ownership and validation", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: "customer-a" } }); });
  it("scopes edits to the signed-in customer and clears outdated coordinates", async () => {
    const query = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id }, error: null }) };
    const update = vi.fn().mockReturnValue(query);
    mocks.client.mockResolvedValue({ from: vi.fn().mockReturnValue({ update }) });
    expect((await saveCustomerAddressAction({ ok: false, message: "" }, addressForm())).ok).toBe(true);
    expect(mocks.origin).toHaveBeenCalled();
    expect(query.eq.mock.calls).toEqual([["id", id], ["user_id", "customer-a"]]);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ latitude: null, longitude: null }));
  });
  it("rejects ownership misses instead of reporting successful deletion", async () => {
    const query = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    mocks.client.mockResolvedValue({ from: vi.fn().mockReturnValue({ delete: () => query }) });
    expect((await deleteCustomerAddressAction(id)).ok).toBe(false);
    expect(query.eq).toHaveBeenCalledWith("user_id", "customer-a");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("validates before database mutations and reuses the existing add action", async () => {
    const form = addressForm(); form.set("addressId", "");
    form.set("postalCode", "bad");
    expect((await saveCustomerAddressAction({ ok: false, message: "" }, form)).ok).toBe(false);
    expect(mocks.add).not.toHaveBeenCalled();
    form.set("postalCode", "0001");
    expect((await saveCustomerAddressAction({ ok: false, message: "" }, form)).ok).toBe(true);
    expect(mocks.add).toHaveBeenCalledWith(form);
  });
  it("uses the atomic default RPC with the authenticated client", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null }); mocks.client.mockResolvedValue({ rpc });
    expect((await setDefaultCustomerAddressAction(id)).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("set_customer_default_address", { p_address_id: id });
  });
});
