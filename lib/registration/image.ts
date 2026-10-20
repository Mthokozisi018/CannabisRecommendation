import "server-only";
import sharp from "sharp";
import { MAX_DOCUMENT_BYTES } from "./validation";

export async function prepareDocumentImage(file: File) {
  if (!file.size || file.size > MAX_DOCUMENT_BYTES) throw new Error("Choose an image no larger than 6 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(bytes, { limitInputPixels: 24_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp", "heif"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error();
    // Decode actual pixels, apply EXIF orientation, and strip EXIF/location metadata.
    return await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  } catch { throw new Error("Choose a readable JPEG, PNG, WebP or supported HEIC image."); }
}
