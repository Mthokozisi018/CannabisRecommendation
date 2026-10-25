import "server-only";
import { Client } from "@elastic/elasticsearch";
import { customerFullName } from "@/lib/pos-customer-format";

export const CUSTOMER_INDEX = "greenchoice_customers";

export type IndexablePOSCustomer = {
  id: string;
  store_id: string;
  first_name: string;
  surname: string;
  phone_display: string | null;
  phone_digits: string;
  created_at: string;
  deleted_at: string | null;
};

let client: Client | null = null;

export function customerSearchClient() {
  const url = process.env.ELASTICSEARCH_URL;
  if (!url) return null;
  if (!client) {
    const endpoint = new URL(url);
    const local = ["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname);
    if (endpoint.username || endpoint.password || (!local && (endpoint.protocol !== "https:" || !process.env.ELASTICSEARCH_API_KEY))) {
      throw new Error("Elasticsearch requires HTTPS and an API key outside localhost; URL credentials are not supported.");
    }
    client = new Client({
      node: url,
      ...(process.env.ELASTICSEARCH_API_KEY ? { auth: { apiKey: process.env.ELASTICSEARCH_API_KEY } } : {}),
      requestTimeout: 2500,
      maxRetries: 0
    });
  }
  return client;
}

export async function ensureCustomerIndex(search = customerSearchClient()) {
  if (!search) throw new Error("Elasticsearch is not configured.");
  if (await search.indices.exists({ index: CUSTOMER_INDEX })) return;
  try {
    await search.indices.create({
      index: CUSTOMER_INDEX,
      mappings: {
        dynamic: "strict",
        properties: {
          customer_id: { type: "keyword" },
          store_id: { type: "keyword" },
          name: { type: "text", analyzer: "standard" },
          surname: { type: "text", analyzer: "standard" },
          full_name: { type: "text", analyzer: "standard" },
          cellphone: { type: "keyword" },
          phone_digits: { type: "keyword" },
          created_at: { type: "date" }
        }
      }
    });
  } catch (error) {
    if (await search.indices.exists({ index: CUSTOMER_INDEX })) return;
    throw error;
  }
}

export function customerDocument(row: IndexablePOSCustomer) {
  return {
    customer_id: row.id,
    store_id: row.store_id,
    name: row.first_name,
    surname: row.surname,
    full_name: customerFullName(row.first_name, row.surname),
    cellphone: row.phone_display || row.phone_digits,
    phone_digits: row.phone_digits,
    created_at: row.created_at
  };
}

export async function indexPOSCustomer(row: IndexablePOSCustomer) {
  const search = customerSearchClient();
  if (!search) return;
  await ensureCustomerIndex(search);
  if (row.deleted_at) {
    await search.delete({ index: CUSTOMER_INDEX, id: row.id }, { ignore: [404] });
  } else {
    await search.index({ index: CUSTOMER_INDEX, id: row.id, document: customerDocument(row) });
  }
}

export async function findIndexedPOSCustomers(storeId: string, mode: "phone" | "name", term: string, signal?: AbortSignal) {
  const search = customerSearchClient();
  if (!search) throw new Error("Elasticsearch is not configured.");
  const digits = term.replace(/\D/g, "").replace(/^27(?=[6-8])/, "0").replace(/^[6-8](?=\d)/, "0$&");
  const normalizedTerm = mode === "phone" ? digits : term;
  const result = await search.search<ReturnType<typeof customerDocument>>({
    index: CUSTOMER_INDEX,
    size: 10,
    _source: ["customer_id", "store_id", "name", "surname", "full_name", "cellphone"],
    query: {
      bool: {
        filter: [{ term: { store_id: storeId } }],
        should: mode === "phone"
          ? [{ prefix: { phone_digits: { value: normalizedTerm, boost: 4 } } }]
          : [
              { multi_match: { query: normalizedTerm, type: "phrase_prefix", fields: ["full_name^4", "name^2", "surname^2"] } },
              { multi_match: { query: normalizedTerm, type: "bool_prefix", fields: ["full_name^3", "name", "surname"] } }
            ],
        minimum_should_match: 1
      }
    }
  }, { signal });
  return result.hits.hits.flatMap((hit) => {
    const row = hit._source;
    if (!row || row.store_id !== storeId) return [];
    return [{ id: row.customer_id, firstName: row.name, surname: row.surname, fullName: row.full_name, phoneNumber: row.cellphone }];
  });
}
