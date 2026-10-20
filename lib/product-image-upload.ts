import "server-only";
import crypto from "node:crypto";
import sharp from "sharp";

const allowedDeclaredMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const mimeTypeForFormat = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
} as const;

export const maxProductImageBytes = 6 * 1024 * 1024;
export const maxProductImageDimension = 6_000;
export const maxProductImagePixels = 24_000_000;

export class ProductImageValidationError extends Error {
  constructor(message = "Product image must be a valid JPEG, PNG, or WebP file.") {
    super(message);
    this.name = "ProductImageValidationError";
  }
}

export type NormalizedProductImage = {
  data: Buffer;
  contentType: "image/webp";
  extension: "webp";
  width: number;
  height: number;
};

async function normalizeImage(file: File, label: "Product" | "Store" | "Supplier"): Promise<NormalizedProductImage> {
  if (file.size <= 0 || file.size > maxProductImageBytes) {
    throw new ProductImageValidationError(`${label} image must be 6MB or smaller.`);
  }
  if (!allowedDeclaredMimeTypes.has(file.type.toLowerCase())) {
    throw new ProductImageValidationError(`${label} image must be a valid JPEG, PNG, or WebP file.`);
  }

  const input = Buffer.from(await file.arrayBuffer());
  try {
    const decoder = sharp(input, {
      failOn: "error",
      limitInputPixels: maxProductImagePixels
    });
    const metadata = await decoder.metadata();
    const actualMimeType = metadata.format
      ? mimeTypeForFormat[metadata.format as keyof typeof mimeTypeForFormat]
      : undefined;
    if (!actualMimeType || actualMimeType !== file.type.toLowerCase()) {
      throw new ProductImageValidationError(`${label} image type does not match its contents.`);
    }
    if (!metadata.width || !metadata.height ||
        metadata.width > maxProductImageDimension ||
        metadata.height > maxProductImageDimension ||
        metadata.width * metadata.height > maxProductImagePixels ||
        (metadata.pages ?? 1) !== 1) {
      throw new ProductImageValidationError(`${label} image dimensions are not supported.`);
    }

    const normalized = await decoder
      .rotate()
      .resize({
        width: 2_400,
        height: 2_400,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: 88, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    return {
      data: normalized.data,
      contentType: "image/webp",
      extension: "webp",
      width: normalized.info.width,
      height: normalized.info.height
    };
  } catch (error) {
    if (error instanceof ProductImageValidationError) throw error;
    throw new ProductImageValidationError(`${label} image must be a valid JPEG, PNG, or WebP file.`);
  }
}

export async function normalizeProductImage(file: File): Promise<NormalizedProductImage> {
  return normalizeImage(file, "Product");
}

export async function normalizeStoreImage(file: File): Promise<NormalizedProductImage> {
  return normalizeImage(file, "Store");
}

export async function normalizeSupplierImage(file: File): Promise<NormalizedProductImage> {
  return normalizeImage(file, "Supplier");
}

export function productImageObjectPath(storeId: string, productId: string) {
  return `stores/${storeId}/products/${productId}/${crypto.randomUUID()}.webp`;
}

export function storeImageObjectPath(storeId: string) {
  return `stores/${storeId}/cover/${crypto.randomUUID()}.webp`;
}

export function supplierImageObjectPath(storeId: string, supplierId: string) {
  return `stores/${storeId}/suppliers/${supplierId}/${crypto.randomUUID()}.webp`;
}
