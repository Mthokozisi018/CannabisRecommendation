import { describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { generateRegistrationPoster } from "@/lib/registration/poster";

describe("supplied registration poster", () => {
  it("preserves the original template pixels outside its white QR opening", async () => {
    const image = await generateRegistrationPoster(`https://greenchoice.example.invalid/register/${"a".repeat(64)}`);
    const poster = Buffer.from(image.split(",")[1], "base64");
    for (const region of [
      { left: 0, top: 0, width: 1024, height: 591 },
      { left: 0, top: 961, width: 1024, height: 575 },
      { left: 0, top: 591, width: 318, height: 370 },
      { left: 706, top: 591, width: 318, height: 370 },
    ]) {
      const original = await sharp("public/branding/greenchoice-registration-template.png").extract(region).removeAlpha().raw().toBuffer();
      const actual = await sharp(poster).extract(region).removeAlpha().raw().toBuffer();
      expect(actual.equals(original)).toBe(true);
    }
  });
  it("centres intact modules and four-module white padding within the opening", async () => {
    const link = `https://greenchoice.example.invalid/register/${"b".repeat(64)}`;
    const image = await generateRegistrationPoster(link);
    const modules = QRCode.create(link, { errorCorrectionLevel: "M" }).modules;
    const scale = Math.floor(350 / (modules.size + 8));
    const size = (modules.size + 8) * scale;
    const left = Math.round(512 - size / 2), top = Math.round(776 - size / 2);
    expect(left).toBeGreaterThan(318); expect(top).toBeGreaterThan(591);
    expect(left + size).toBeLessThan(706); expect(top + size).toBeLessThan(961);
    const pixels = await sharp(Buffer.from(image.split(",")[1], "base64")).extract({ left, top, width: size, height: size }).removeAlpha().raw().toBuffer();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const row = Math.floor(y / scale) - 4, col = Math.floor(x / scale) - 4;
      const dark = row >= 0 && col >= 0 && row < modules.size && col < modules.size && modules.get(row, col);
      const index = (y * size + x) * 3;
      if (pixels[index] !== (dark ? 16 : 255) || pixels[index + 1] !== (dark ? 39 : 255) || pixels[index + 2] !== (dark ? 26 : 255)) {
        throw new Error(`QR module or quiet-zone pixels changed at ${x},${y}`);
      }
    }
  });
  it.each(["https://example.invalid/", "https://user:secret@example.invalid/register/" + "a".repeat(64), "https://example.invalid/register/" + "a".repeat(64) + "?secret=1"])("rejects invalid registration URL %s", async link => {
    await expect(generateRegistrationPoster(link)).rejects.toThrow("Invalid store registration URL");
  });
});
