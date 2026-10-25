import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@elastic/elasticsearch", () => ({ Client: class { search = search; } }));

import { findIndexedPOSCustomers } from "@/lib/receptionist/customer-search-index";

const previousUrl = process.env.ELASTICSEARCH_URL;
beforeAll(() => { process.env.ELASTICSEARCH_URL = "http://127.0.0.1:9200"; });
afterAll(() => {
  if (previousUrl === undefined) delete process.env.ELASTICSEARCH_URL;
  else process.env.ELASTICSEARCH_URL = previousUrl;
});

describe("Elasticsearch POS customer search", () => {
  it("normalizes an international phone prefix and filters by the authorized store", async () => {
    search.mockResolvedValueOnce({ hits: { hits: [
      { _source: { customer_id: "a", store_id: "store-a", name: "Zola", surname: "Local", full_name: "Zola Local", cellphone: "079 600 2707" } },
      { _source: { customer_id: "b", store_id: "store-b", name: "Other", surname: "Store", full_name: "Other Store", cellphone: "079 600 2707" } }
    ] } });
    const result = await findIndexedPOSCustomers("store-a", "phone", "+27 79 600 2707");
    expect(search).toHaveBeenCalledWith(expect.objectContaining({
      size: 10,
      query: { bool: { filter: [{ term: { store_id: "store-a" } }], should: [{ prefix: { phone_digits: { value: "0796002707", boost: 4 } } }], minimum_should_match: 1 } }
    }), { signal: undefined });
    expect(result.map((customer) => customer.id)).toEqual(["a"]);
  });

  it("uses name prefix matching for typeahead", async () => {
    search.mockResolvedValueOnce({ hits: { hits: [] } });
    await findIndexedPOSCustomers("store-a", "name", "Mthokozisi Skho");
    expect(search.mock.calls.at(-1)?.[0].query.bool.should[0].multi_match).toMatchObject({
      query: "Mthokozisi Skho", type: "phrase_prefix"
    });
  });
});
