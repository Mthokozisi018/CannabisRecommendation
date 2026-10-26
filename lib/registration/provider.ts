import "server-only";
import { z } from "zod";
import { ageAt, validDate } from "./validation";
import { internalDocumentProvider } from "./internal-document-reader";

export type VerificationCode = "unavailable" | "unreadable" | "mismatch" | "age_unconfirmed" | "under_age" | "manual_review";
export const verificationMessages: Record<VerificationCode, string> = {
  unavailable: "Verification is temporarily unavailable. Please contact the store for assistance.",
  unreadable: "We could not read the document clearly. Retake the photo or choose another image.",
  mismatch: "The number on the document does not match the number entered.",
  age_unconfirmed: "We could not confirm your age. Please contact the store for assistance.",
  under_age: "You must be at least 18 years old to register.",
  manual_review: "Manual review required. Please contact the store for authorised assistance."
};
export class VerificationError extends Error {
  constructor(public code: VerificationCode) { super(verificationMessages[code]); }
}
const resultSchema = z.object({
  status: z.enum(["read", "unreadable", "manual_review"]),
  documentType: z.enum(["sa_id", "passport"]),
  documentNumber: z.string().max(30).optional(),
  dateOfBirth: z.string().optional()
}).strict();
export type DocumentResult = z.infer<typeof resultSchema>;
export interface DocumentProvider {
  read(image: Buffer, type: "sa_id" | "passport", requestId: string): Promise<DocumentResult>;
}

// Adapter contract for an APPROVED provider gateway. Never use browser-supplied verification.
export function configuredDocumentProvider(): DocumentProvider {
  const endpoint = process.env.QR_VERIFICATION_URL;
  const key = process.env.QR_VERIFICATION_API_KEY;
  // The bundled server-side reader performs the same number and age checks
  // without sending customer images to a third-party gateway.
  if (!endpoint && !key && !process.env.QR_VERIFICATION_APPROVED) return internalDocumentProvider;
  if (process.env.QR_VERIFICATION_APPROVED !== "true" || !endpoint || !key) throw new VerificationError("unavailable");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password) throw new VerificationError("unavailable");
  return {
    async read(image, type, requestId) {
      try {
        const body = new FormData();
        body.set("documentType", type);
        body.set("image", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "document.jpg");
        const response = await fetch(url, {
          method: "POST", body, redirect: "error", cache: "no-store",
          headers: { Authorization: `Bearer ${key}`, "Idempotency-Key": requestId },
          signal: AbortSignal.timeout(25_000)
        });
        if (!response.ok) throw new VerificationError("unavailable");
        // Bound provider output; never persist raw OCR or include it in exception messages.
        const reader = response.body?.getReader();
        if (!reader) throw new VerificationError("unavailable");
        let bytes = 0;
        const chunks: Uint8Array[] = [];
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 4096) throw new VerificationError("unavailable");
            chunks.push(value);
          }
        } finally { await reader.cancel(); }
        return resultSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch { throw new VerificationError("unavailable"); }
    }
  };
}

export function confirmDocument(result: DocumentResult, type: "sa_id" | "passport", number: string, today?: string) {
  if (result.status === "manual_review") throw new VerificationError("manual_review");
  if (result.status === "unreadable" || !result.documentNumber) throw new VerificationError("unreadable");
  const extracted = result.documentNumber.toUpperCase().replace(/[\s-]/g, "");
  if (result.documentType !== type || extracted !== number) throw new VerificationError("mismatch");
  if (!result.dateOfBirth || !validDate(result.dateOfBirth)) throw new VerificationError("age_unconfirmed");
  if (type === "sa_id" && result.dateOfBirth.replace(/-/g, "").slice(2) !== number.slice(0, 6)) throw new VerificationError("age_unconfirmed");
  const age = ageAt(result.dateOfBirth, today);
  if (age === null) throw new VerificationError("age_unconfirmed");
  if (age < 18) throw new VerificationError("under_age");
  return { numberMatched: true as const, ageConfirmed: true as const };
}
