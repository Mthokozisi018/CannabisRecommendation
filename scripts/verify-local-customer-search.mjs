import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@elastic/elasticsearch";
import { createClient } from "@supabase/supabase-js";
import { buildLocalEnvironment, parseEnvFile, validateLocalEnvironment } from "./verify-local-environment.mjs";

const requested = process.env.GREENCHOICE_STAGING_ENV_FILE;
const candidates = requested
  ? [resolve(process.cwd(), requested)]
  : [resolve(process.cwd(), ".env.staging.local")];
const envPath = candidates.find((path) => existsSync(path));
if (!envPath) throw new Error("Staging environment file not found.");
const env = buildLocalEnvironment(parseEnvFile(readFileSync(envPath, "utf8")));
const failures = validateLocalEnvironment(env);
if (failures.length) throw new Error(`Invalid staging environment: ${failures.join(" ")}`);
if (!env.ELASTICSEARCH_URL) throw new Error("ELASTICSEARCH_URL is required.");

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const elastic = new Client({ node: env.ELASTICSEARCH_URL, ...(env.ELASTICSEARCH_API_KEY ? { auth: { apiKey: env.ELASTICSEARCH_API_KEY } } : {}) });
const { data: customers, error } = await db.from("pos_customers")
  .select("id,store_id,first_name,surname,phone_digits").is("deleted_at", null).limit(20);
if (error) throw error;
if (!customers?.length) throw new Error("No staging POS customers are available to test.");

let nameWorks = true;
let surnameWorks = true;
let phoneWorks = true;
let storeIsolation = true;
for (const customer of customers) {
  const filter = [{ term: { store_id: customer.store_id } }];
  const nameResult = await elastic.search({
    index: "greenchoice_customers", size: 10,
    query: { bool: { filter, should: [{ multi_match: { query: customer.first_name.slice(0, 3).toUpperCase(), type: "phrase_prefix", fields: ["full_name^4", "name^2", "surname^2"] } }], minimum_should_match: 1 } }
  });
  const phoneResult = await elastic.search({
    index: "greenchoice_customers", size: 10,
    query: { bool: { filter, should: [{ prefix: { phone_digits: { value: customer.phone_digits.slice(0, 4), boost: 4 } } }], minimum_should_match: 1 } }
  });
  const surnameResult = await elastic.search({
    index: "greenchoice_customers", size: 10,
    query: { bool: { filter, should: [{ multi_match: { query: customer.surname.slice(0, 3).toUpperCase(), type: "phrase_prefix", fields: ["full_name^4", "name^2", "surname^2"] } }], minimum_should_match: 1 } }
  });
  nameWorks &&= nameResult.hits.hits.some((hit) => hit._id === customer.id);
  surnameWorks &&= surnameResult.hits.hits.some((hit) => hit._id === customer.id);
  phoneWorks &&= phoneResult.hits.hits.some((hit) => hit._id === customer.id);
  storeIsolation &&= [...nameResult.hits.hits, ...surnameResult.hits.hits, ...phoneResult.hits.hits].every((hit) => hit._source?.store_id === customer.store_id);
}

const otherStoreCustomer = customers.find((customer) => customer.store_id !== customers[0].store_id);
if (otherStoreCustomer) {
  const crossStore = await elastic.search({
    index: "greenchoice_customers", size: 10,
    query: { bool: { filter: [{ term: { store_id: otherStoreCustomer.store_id } }], must: [{ prefix: { phone_digits: customers[0].phone_digits.slice(0, 4) } }] } }
  });
  storeIsolation &&= !crossStore.hits.hits.some((hit) => hit._id === customers[0].id);
}

const result = {
  customersChecked: customers.length,
  storesChecked: new Set(customers.map((customer) => customer.store_id)).size,
  nameWorks,
  surnameWorks,
  phoneWorks,
  storeIsolation
};
console.log(JSON.stringify(result));
if (!nameWorks || !surnameWorks || !phoneWorks || !storeIsolation) process.exitCode = 1;
