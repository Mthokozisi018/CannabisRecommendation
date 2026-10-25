import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { decryptRegistrationDocument, encryptRegistrationDocument } from "@/lib/registration/document-encryption";

describe("registration document encryption", () => {
  beforeEach(() => vi.stubEnv("CUSTOMER_DOCUMENT_ENCRYPTION_KEY", Buffer.alloc(32, 41).toString("base64")));

  it("round trips with a fresh nonce and keeps source bytes out of stored objects", () => {
    const image = Buffer.from("sensitive JPEG bytes");
    const first = encryptRegistrationDocument(image, "store-a:submission-a:path-a");
    const second = encryptRegistrationDocument(image, "store-a:submission-a:path-a");
    expect(first).not.toEqual(second);
    expect(first.includes(image)).toBe(false);
    expect(decryptRegistrationDocument(first, "store-a:submission-a:path-a")).toEqual(image);
  });

  it("rejects tampering, wrong context, wrong key, and malformed envelopes", () => {
    const envelope = encryptRegistrationDocument(Buffer.from("photo"), "store-a:submission-a:path-a");
    expect(() => decryptRegistrationDocument(envelope, "store-b:submission-a:path-a")).toThrow();
    const altered = Buffer.from(envelope); altered[altered.length - 1] ^= 1;
    expect(() => decryptRegistrationDocument(altered, "store-a:submission-a:path-a")).toThrow();
    expect(() => decryptRegistrationDocument(Buffer.from("photo"), "store-a:submission-a:path-a")).toThrow();
    vi.stubEnv("CUSTOMER_DOCUMENT_ENCRYPTION_KEY", Buffer.alloc(32, 42).toString("base64"));
    expect(() => decryptRegistrationDocument(envelope, "store-a:submission-a:path-a")).toThrow();
  });
});
