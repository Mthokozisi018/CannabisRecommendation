import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const environment = process.env.GREENCHOICE_ENV || "unknown";
const endpoint = process.env.RATE_LIMIT_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.RATE_LIMIT_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (endpoint && token) {
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000)
    });
    const body = await response.json().catch(() => ({}));
    console.log(JSON.stringify({ environment, service: "redis", status: response.status, healthy: response.ok && body.result === "PONG" }));
  } catch (error) {
    console.log(JSON.stringify({ environment, service: "redis", healthy: false, category: error?.name || "unknown" }));
  }
} else {
  console.log(JSON.stringify({ environment, service: "redis", healthy: false, category: "missing_configuration" }));
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && secret) {
  try {
    const client = createClient(url, secret, { auth: { persistSession: false } });
    const key = `greenchoice:rl:diagnostic:${crypto.randomBytes(32).toString("hex")}:60000`;
    const { data, error } = await client.rpc("consume_request_rate_limit", {
      p_key_hash: key,
      p_limit: 2,
      p_window_ms: 60_000
    });
    console.log(JSON.stringify({ environment, service: "supabase_rpc", healthy: !error && data?.[0]?.request_count === 1 && !!data?.[0]?.reset_at, code: error?.code || null }));
  } catch (error) {
    console.log(JSON.stringify({ environment, service: "supabase_rpc", healthy: false, category: error?.name || "unknown" }));
  }
} else {
  console.log(JSON.stringify({ environment, service: "supabase_rpc", healthy: false, category: "missing_configuration" }));
}
