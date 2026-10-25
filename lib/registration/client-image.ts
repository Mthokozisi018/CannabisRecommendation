import { MAX_REGISTRATION_UPLOAD_BYTES } from "./validation";

export const MAX_REGISTRATION_SOURCE_BYTES = 12 * 1024 * 1024;
export const uploadTooLargeMessage = "This photo is too large to send. Take a lower-resolution photo or choose an image under 4 MB.";

export async function prepareRegistrationUpload(file: File): Promise<File> {
  if (!file.size || file.size > MAX_REGISTRATION_SOURCE_BYTES) throw new Error(uploadTooLargeMessage);
  if (file.size <= MAX_REGISTRATION_UPLOAD_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(uploadTooLargeMessage);
  }
  try {
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error(uploadTooLargeMessage);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.76, 0.64]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size > 0 && blob.size <= MAX_REGISTRATION_UPLOAD_BYTES)
        return new File([blob], "registration-document.jpg", { type: "image/jpeg" });
    }
    throw new Error(uploadTooLargeMessage);
  } finally {
    bitmap.close();
  }
}
