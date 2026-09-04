import "server-only";
import crypto from "node:crypto";

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

export async function normalizeProductImage(file: File): Promise<NormalizedProductImage> {
  if (file.size <= 0 || file.size > maxProductImageBytes) {
    throw new ProductImageValidationError("Product image must be 6MB or smaller.");
  }
  if (!allowedDeclaredMimeTypes.has(file.type.toLowerCase())) {
    throw new ProductImageValidationError();
  }

  const input = Buffer.from(await file.arrayBuffer());
  try {
    // Load the native image processor only when a product picture is supplied.
    // This keeps product creation available if the optional native runtime cannot
    // initialize and lets this function turn that failure into a validation error.
    const { default: sharp } = await import("sharp");
    const decoder = sharp(input, {
      failOn: "error",
      limitInputPixels: maxProductImagePixels
    });
    const metadata = await decoder.metadata();
    const actualMimeType = metadata.format
      ? mimeTypeForFormat[metadata.format as keyof typeof mimeTypeForFormat]
      : undefined;
    if (!actualMimeType || actualMimeType !== file.type.toLowerCase()) {
      throw new ProductImageValidationError("Product image type does not match its contents.");
    }
    if (!metadata.width || !metadata.height ||
        metadata.width > maxProductImageDimension ||
        metadata.height > maxProductImageDimension ||
        metadata.width * metadata.height > maxProductImagePixels ||
        (metadata.pages ?? 1) !== 1) {
      throw new ProductImageValidationError("Product image dimensions are not supported.");
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
    throw new ProductImageValidationError();
  }
}

export function productImageObjectPath(storeId: string, productId: string) {
  return `stores/${storeId}/products/${productId}/${crypto.randomUUID()}.webp`;
}
