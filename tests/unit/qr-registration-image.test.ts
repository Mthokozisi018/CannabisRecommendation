import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import sharp from "sharp";
import { prepareDocumentImage } from "@/lib/registration/image";
describe("private document image preparation", () => {
  it("rejects executable/SVG content disguised as a photograph", async () => {
    await expect(prepareDocumentImage(new File(["<svg xmlns='http://www.w3.org/2000/svg'><rect width='10' height='10'/></svg>"], "id.jpg", { type: "image/jpeg" }))).rejects.toThrow("readable");
    await expect(prepareDocumentImage(new File(["not an image"], "id.png", { type: "image/png" }))).rejects.toThrow("readable");
  });
  it("decodes actual content, corrects EXIF orientation and strips metadata", async () => {
    const bytes = await sharp({ create: { width: 40, height: 20, channels: 3, background: "white" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const output = await prepareDocumentImage(new File([new Uint8Array(bytes)], "document.bin"));
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("jpeg"); expect(meta.width).toBe(20); expect(meta.height).toBe(40); expect(meta.exif).toBeUndefined();
  });
  it("rejects oversized or empty files", async () => {
    await expect(prepareDocumentImage(new File([], "id.jpg"))).rejects.toThrow("6 MB");
    await expect(prepareDocumentImage(new File([new Uint8Array(6 * 1024 * 1024 + 1)], "id.jpg"))).rejects.toThrow("6 MB");
  });
});
