import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const schema = z.object({ storeName: z.string().max(300), maskedPhone: z.string().max(30), expires: z.number() }).strict();
function secret() {
  const key = process.env.SESSION_SIGNING_SECRET;
  if (!key || key.length < 32) throw new Error("Registration receipt protection is unavailable.");
  return key;
}
export function signRegistrationReceipt(storeName: string, maskedPhone: string) {
  const data = Buffer.from(JSON.stringify({ storeName, maskedPhone, expires: Date.now() + 15 * 60_000 })).toString("base64url");
  return `${data}.${createHmac("sha256", secret()).update(data).digest("base64url")}`;
}
export function readRegistrationReceipt(value?: string) {
  try {
    const [data, sig, extra] = (value ?? "").split(".");
    if (!data || !sig || extra) return null;
    const expected = createHmac("sha256", secret()).update(data).digest("base64url");
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const receipt = schema.parse(JSON.parse(Buffer.from(data, "base64url").toString()));
    return receipt.expires > Date.now() ? receipt : null;
  } catch { return null; }
}
