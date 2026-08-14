import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  maxProductImageBytes,
  normalizeProductImage,
  ProductImageValidationError,
  productImageObjectPath
} from "@/lib/product-image-upload";

async function imageFile(format: "png" | "jpeg" | "webp", declaredType: string, width = 80, height = 60) {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 32, g: 160, b: 72 }
    }
  })[format]().toBuffer();
  return new File([buffer], `product.${format}`, { type: declaredType });
}

describe("product image upload validation", () => {
  it("decodes and normalizes a valid image to metadata-free WebP", async () => {
    const normalized = await normalizeProductImage(await imageFile("png", "image/png"));
    expect(normalized.contentType).toBe("image/webp");
    expect(normalized.extension).toBe("webp");
    expect(normalized.width).toBe(80);
    expect(normalized.height).toBe(60);
    expect((await sharp(normalized.data).metadata()).format).toBe("webp");
  });

  it("rejects a spoofed declared MIME type", async () => {
    await expect(normalizeProductImage(await imageFile("png", "image/jpeg")))
      .rejects.toThrow("does not match");
  });

  it("rejects invalid image bytes and unsupported MIME types", async () => {
    await expect(normalizeProductImage(new File(["not an image"], "fake.png", { type: "image/png" })))
      .rejects.toBeInstanceOf(ProductImageValidationError);
    await expect(normalizeProductImage(new File(["gif"], "fake.gif", { type: "image/gif" })))
      .rejects.toBeInstanceOf(ProductImageValidationError);
  });

  it("rejects oversized files and excessive dimensions", async () => {
    const oversized = new File([new Uint8Array(maxProductImageBytes + 1)], "large.png", { type: "image/png" });
    await expect(normalizeProductImage(oversized)).rejects.toThrow("6MB or smaller");
    await expect(normalizeProductImage(await imageFile("png", "image/png", 6_001, 1)))
      .rejects.toThrow("dimensions are not supported");
  });

  it("creates immutable store-prefixed object paths", () => {
    const storeId = "10000000-0000-4000-8000-000000000001";
    const productId = "20000000-0000-4000-8000-000000000002";
    const first = productImageObjectPath(storeId, productId);
    const second = productImageObjectPath(storeId, productId);
    expect(first).toMatch(new RegExp(`^stores/${storeId}/products/${productId}/[0-9a-f-]+\\.webp$`));
    expect(second).not.toBe(first);
  });
});
