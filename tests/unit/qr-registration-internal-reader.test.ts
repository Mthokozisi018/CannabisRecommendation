import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { internalDocumentProvider, readDocumentText } from "@/lib/registration/internal-document-reader";
import { confirmDocument } from "@/lib/registration/provider";

const saId = "9001015009086";

describe("bundled document reader", () => {
  it("requires a full printed birth date for SA IDs instead of guessing the century", () => {
    const text = `REPUBLIC OF SOUTH AFRICA\nIDENTITY DOCUMENT\nID NO: ${saId}`;
    expect(() => confirmDocument(readDocumentText(text, "sa_id"), "sa_id", saId)).toThrow("confirm your age");
    expect(confirmDocument(readDocumentText(`${text}\nDATE OF BIRTH: 01 JAN 1990`, "sa_id"), "sa_id", saId).ageConfirmed).toBe(true);
  });

  it("does not mistake passport expiry for birth date or accept a number-only image", () => {
    const passport = "PASSPORT\nPASSPORT NO: A00123456\nDATE OF EXPIRY: 2030-01-01";
    expect(() => confirmDocument(readDocumentText(passport, "passport"), "passport", "A00123456")).toThrow("confirm your age");
    expect(readDocumentText("A00123456\nDATE OF BIRTH: 1990-01-01", "passport").status).toBe("unreadable");
    expect(confirmDocument(readDocumentText(`${passport}\nDATE OF BIRTH: 1990-01-01`, "passport"), "passport", "A00123456").ageConfirmed).toBe(true);
  });

  it("reads a synthetic document using only the bundled model", async () => {
    const svg = `<svg width="1200" height="700" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="50" y="120" font-family="Arial" font-size="56">REPUBLIC OF SOUTH AFRICA</text><text x="50" y="240" font-family="Arial" font-size="44">IDENTITY DOCUMENT</text><text x="50" y="360" font-family="Arial" font-size="44">ID NO: ${saId}</text><text x="50" y="480" font-family="Arial" font-size="44">DATE OF BIRTH: 01 JAN 1990</text></svg>`;
    const image = await sharp(Buffer.from(svg)).jpeg().toBuffer();
    const result = await internalDocumentProvider.read(image, "sa_id", "synthetic-test");
    expect(confirmDocument(result, "sa_id", saId).numberMatched).toBe(true);
  }, 30_000);

  it("reads a synthetic passport without using an expiry date for age", async () => {
    const svg = `<svg width="1200" height="700" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="50" y="120" font-family="Arial" font-size="56">PASSPORT</text><text x="50" y="240" font-family="Arial" font-size="44">PASSPORT NO: A00123456</text><text x="50" y="360" font-family="Arial" font-size="44">DATE OF BIRTH: 1990-01-01</text><text x="50" y="480" font-family="Arial" font-size="44">DATE OF EXPIRY: 2030-01-01</text></svg>`;
    const image = await sharp(Buffer.from(svg)).jpeg().toBuffer();
    const result = await internalDocumentProvider.read(image, "passport", "synthetic-test");
    expect(confirmDocument(result, "passport", "A00123456").ageConfirmed).toBe(true);
  }, 30_000);
});
