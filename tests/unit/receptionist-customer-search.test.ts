import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { staff, query, admin, userClient } = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["select", "eq", "is", "in", "limit", "gte", "lt", "ilike", "or", "abortSignal", "insert"]) query[name] = vi.fn(() => query);
  query.order = vi.fn(async () => ({ data: [], error: null }));
  query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  query.single = vi.fn(async () => ({ data: { id: "new", first_name: "Zola", surname: "Local", phone_display: "082 123 4567", phone_normalized: "+27821234567" }, error: null }));
  return { query, staff: vi.fn(), admin: { from: vi.fn(() => query) }, userClient: { from: vi.fn(() => query) } };
});
vi.mock("@/lib/dal/auth", () => ({ requireStaff: staff }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: () => admin, createSupabaseServerClient: async () => userClient }));
const { indexClient, indexedSearch } = vi.hoisted(() => ({ indexClient: vi.fn<() => object | null>(() => null), indexedSearch: vi.fn() }));
vi.mock("@/lib/receptionist/customer-search-index", () => ({ customerSearchClient: indexClient, findIndexedPOSCustomers: indexedSearch, indexPOSCustomer: vi.fn() }));
import { registerReceptionistCustomer, searchReceptionistCustomers } from "@/lib/receptionist/customers";

describe("POS customer lookup and registration", () => {
  beforeEach(() => { vi.clearAllMocks(); staff.mockResolvedValue({ id: "staff", storeId: "store-a", storeAccessStatus: "active" }); });
  it("uses Elasticsearch hits and rechecks the current store before returning a customer", async () => {
    const previousUrl = process.env.ELASTICSEARCH_URL;
    process.env.ELASTICSEARCH_URL = "http://127.0.0.1:9200";
    indexClient.mockReturnValueOnce({});
    indexedSearch.mockResolvedValueOnce([{ id: "customer-a" }, { id: "customer-from-other-store" }]);
    query.in.mockImplementationOnce(() => Promise.resolve({ data: [{ id: "customer-a", first_name: "Zola", surname: "Local", phone_display: "082 123 4567", phone_normalized: "+27821234567" }], error: null }));
    const result = await searchReceptionistCustomers({ mode: "name", query: "Zol", storeId: "attacker" });
    expect(indexedSearch).toHaveBeenCalledWith("store-a", "name", "Zol", undefined);
    expect(query.eq).toHaveBeenCalledWith("store_id", "store-a");
    expect(query.in).toHaveBeenCalledWith("id", ["customer-a", "customer-from-other-store"]);
    expect(result.map((customer) => customer.id)).toEqual(["customer-a"]);
    if (previousUrl === undefined) delete process.env.ELASTICSEARCH_URL;
    else process.env.ELASTICSEARCH_URL = previousUrl;
  });
  it("falls back to the store-scoped Supabase query when Elasticsearch fails", async () => {
    const previousUrl = process.env.ELASTICSEARCH_URL;
    process.env.ELASTICSEARCH_URL = "http://127.0.0.1:9200";
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      indexClient.mockReturnValueOnce({});
      indexedSearch.mockRejectedValueOnce(new Error("Elasticsearch offline"));
      await searchReceptionistCustomers({ mode: "name", query: "Zola" });
      expect(userClient.from).toHaveBeenCalledWith("pos_customers");
      expect(query.eq).toHaveBeenCalledWith("store_id", "store-a");
      expect(query.is).toHaveBeenCalledWith("deleted_at", null);
      expect(query.order).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
      if (previousUrl === undefined) delete process.env.ELASTICSEARCH_URL;
      else process.env.ELASTICSEARCH_URL = previousUrl;
    }
  });
  it.each(["Alice", "Bongi", "O'Connor", "Zoë"])("searches %s with one bounded RLS query", async (name) => {
    await searchReceptionistCustomers({ mode: "name", query: name });
    expect(staff).toHaveBeenCalledWith(["manager", "receptionist"]);
    expect(userClient.from).toHaveBeenCalledTimes(1);
    expect(admin.from).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("store_id", "store-a");
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(query.limit).toHaveBeenCalledWith(8);
    expect(query.select).toHaveBeenCalledWith("id, first_name, surname, phone_display, phone_normalized");
  });
  it("normalizes exact phone and propagates cancellation", async () => {
    const signal = new AbortController().signal;
    await searchReceptionistCustomers({ mode: "phone", query: "082 123 4567" }, signal);
    expect(query.eq).toHaveBeenCalledWith("phone_normalized", "+27821234567");
    expect(query.abortSignal).toHaveBeenCalledWith(signal);
  });
  it("uses bounded prefix range lookup for partial cellphone search", async () => {
    await searchReceptionistCustomers({ mode: "phone", query: "08212" });
    expect(query.gte).toHaveBeenCalledWith("phone_digits", "08212");
    expect(query.lt).toHaveBeenCalledWith("phone_digits", "08213");
    expect(query.ilike).not.toHaveBeenCalledWith("phone_digits", expect.stringContaining("%"));
  });
  it.each(["", "ab", "+++", "%_,()"])("does not issue broad phone query for %s", async (value) => {
    expect(await searchReceptionistCustomers({ mode: "phone", query: value })).toEqual([]);
    expect(query.order).not.toHaveBeenCalled();
  });
  it("does not execute an empty wildcard name query", async () => {
    await searchReceptionistCustomers({ mode: "name", query: "%_,()" });
    expect(query.order).not.toHaveBeenCalled();
  });
  it("uses the currently authorized store on each request", async () => {
    await searchReceptionistCustomers({ mode: "name", query: "Alice", storeId: "attacker" });
    staff.mockResolvedValueOnce({ id: "staff", storeId: "store-b", storeAccessStatus: "active" });
    await searchReceptionistCustomers({ mode: "name", query: "Alice" });
    expect(query.eq).toHaveBeenNthCalledWith(1, "store_id", "store-a");
    expect(query.eq).toHaveBeenNthCalledWith(2, "store_id", "store-b");
  });
  it("fails closed for denied and restricted staff", async () => {
    staff.mockRejectedValueOnce(new Error("Staff authentication required."));
    await expect(searchReceptionistCustomers({ mode: "name", query: "Alice" })).rejects.toThrow();
    staff.mockResolvedValueOnce({ storeId: "store-a", storeAccessStatus: "restricted" });
    await expect(searchReceptionistCustomers({ mode: "name", query: "Alice" })).rejects.toThrow();
    expect(userClient.from).not.toHaveBeenCalled();
  });
  it("does not let staff bypass QR document, age and acknowledgement checks", async () => {
    await expect(registerReceptionistCustomer({ firstName: "Zola", surname: "Local", phoneNumber: "0821234567" })).rejects.toThrow("registration QR code");
    expect(query.insert).not.toHaveBeenCalled();
    expect(staff).toHaveBeenCalledWith(["manager", "receptionist"]);
  });
  it("uses the live database for phone searches even with an enabled stale index", async () => {
    const previousUrl = process.env.ELASTICSEARCH_URL;
    process.env.ELASTICSEARCH_URL = "http://127.0.0.1:9200";
    try {
      await searchReceptionistCustomers({ mode: "phone", query: "0821234567" });
      expect(indexedSearch).not.toHaveBeenCalled(); expect(userClient.from).toHaveBeenCalledWith("pos_customers");
      expect(query.eq).toHaveBeenCalledWith("phone_normalized", "+27821234567");
    } finally { if (previousUrl === undefined) delete process.env.ELASTICSEARCH_URL; else process.env.ELASTICSEARCH_URL = previousUrl; }
  });
});
