import crypto from "crypto";
import { headers } from "next/headers";

const windows = new Map<string, { count: number; resetAt: number }>();

export function assertRateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new Error("Rate limit exceeded. Please wait before trying again.");
  }
}

export function signCsrfToken(token: string) {
  const secret = process.env.CSRF_SECRET ?? "local-dev-csrf-secret";
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export function verifyCsrfToken(token: string | null, signature: string | null) {
  if (!token || !signature) return false;
  const expected = signCsrfToken(token);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function verifyOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const host = headerStore.get("host");
  if (!origin || !host) return true;
  const appUrl = process.env.APP_URL ? new URL(process.env.APP_URL) : null;
  const originHost = new URL(origin).host;
  if (originHost === host) return true;
  if (appUrl && originHost === appUrl.host) return true;
  throw new Error("Invalid request origin.");
}
