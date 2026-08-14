import "server-only";
import crypto from "crypto";

function temporaryCredentialSecret() {
  const secret =
    process.env.GREENCHOICE_PASSWORD_FINGERPRINT_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Temporary password credential secret is not configured.");
  return secret;
}

export function managerCreatedTemporaryAuthPassword(email: string, managerChosenPassword: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !managerChosenPassword) {
    throw new Error("Temporary receptionist credentials are required.");
  }
  const digest = crypto
    .createHmac("sha256", temporaryCredentialSecret())
    .update(normalizedEmail, "utf8")
    .update("\0", "utf8")
    .update(managerChosenPassword, "utf8")
    .digest("hex");
  return `Gc1!${digest}`;
}
