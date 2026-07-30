import "server-only";
import crypto from "crypto";

function fingerprintSecret() {
  const secret = process.env.GREENCHOICE_PASSWORD_FINGERPRINT_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Temporary password fingerprint secret is not configured.");
  return secret;
}

export function temporaryPasswordFingerprint(password: string) {
  return `v1:${crypto.createHmac("sha256", fingerprintSecret()).update(password, "utf8").digest("hex")}`;
}

export function temporaryPasswordMatchesFingerprint(password: string, fingerprint: string | null | undefined) {
  if (!fingerprint) return false;
  const next = temporaryPasswordFingerprint(password);
  if (next.length !== fingerprint.length) return false;
  return crypto.timingSafeEqual(Buffer.from(next), Buffer.from(fingerprint));
}
