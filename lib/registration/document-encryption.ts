import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("GCD1");
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + NONCE_BYTES + TAG_BYTES;

function documentKey() {
  const encoded = process.env.CUSTOMER_DOCUMENT_ENCRYPTION_KEY ?? "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error("Document encryption is unavailable.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new Error("Document encryption is unavailable.");
  return key;
}

export function encryptRegistrationDocument(image: Buffer, context: string): Buffer {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", documentKey(), nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(image), cipher.final()]);
  return Buffer.concat([MAGIC, nonce, cipher.getAuthTag(), ciphertext]);
}

// For a future authorized backend retrieval path. No browser-facing document reader exists.
export function decryptRegistrationDocument(envelope: Buffer, context: string): Buffer {
  if (envelope.length < HEADER_BYTES || !envelope.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Invalid encrypted document.");
  }
  const nonce = envelope.subarray(MAGIC.length, MAGIC.length + NONCE_BYTES);
  const tag = envelope.subarray(MAGIC.length + NONCE_BYTES, HEADER_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", documentKey(), nonce, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(envelope.subarray(HEADER_BYTES)), decipher.final()]);
}
