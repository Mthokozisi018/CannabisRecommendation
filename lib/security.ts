import crypto from "crypto";
import { headers } from "next/headers";
import { requireRateLimit } from "@/lib/rate-limit";

export async function assertRateLimit(key: string, limit = 20, windowMs = 60_000) {
  return requireRateLimit({
    namespace: "legacy",
    identifiers: [key],
    limit,
    windowMs,
    localFallbackWhenConfiguredProviderFails: true
  });
}

export function signCsrfToken(token: string) {
  const secret = process.env.CSRF_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("CSRF protection is not configured.");
  }
  return crypto.createHmac("sha256", secret || "local-dev-csrf-secret").update(token).digest("hex");
}

export function verifyCsrfToken(token: string | null, signature: string | null) {
  if (!token || !signature) return false;
  const expected = signCsrfToken(token);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function verifyOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (!origin) throw new Error("Request origin is required.");

  const configured = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.ALLOWED_ORIGINS?.split(",") ?? [])
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        throw new Error("Application origin configuration is invalid.");
      }
    });

  if (process.env.NODE_ENV !== "production") {
    configured.push("http://127.0.0.1:3001", "http://localhost:3001");
  }
  if (configured.length === 0) throw new Error("Application origins are not configured.");

  let normalizedOrigin = "";
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    throw new Error("Invalid request origin.");
  }
  if (!new Set(configured).has(normalizedOrigin)) throw new Error("Invalid request origin.");
  return true;
}
