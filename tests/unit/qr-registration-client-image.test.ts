// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { MAX_REGISTRATION_UPLOAD_BYTES } from "@/lib/registration/validation";
import { prepareRegistrationUpload } from "@/lib/registration/client-image";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps a small document unchanged for an idempotent retry", async () => {
  const file = new File(["small"], "id.jpg", { type: "image/jpeg" });
  expect(await prepareRegistrationUpload(file)).toBe(file);
});

it("reduces a mobile photo below the function request limit", async () => {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }));
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob([new Uint8Array(3_000_000)], { type: "image/jpeg" })));
  const original = new File([new Uint8Array(5_000_000)], "android-photo.jpg", { type: "image/jpeg" });
  const prepared = await prepareRegistrationUpload(original);
  expect(prepared.size).toBeLessThanOrEqual(MAX_REGISTRATION_UPLOAD_BYTES);
  expect(prepared.type).toBe("image/jpeg");
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2400, 1800);
  expect(close).toHaveBeenCalledOnce();
});

it("keeps the document local when a large image cannot be decoded", async () => {
  vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("unsupported codec")));
  const original = new File([new Uint8Array(5_000_000)], "large.heic", { type: "image/heic" });
  await expect(prepareRegistrationUpload(original)).rejects.toThrow("lower-resolution photo");
});
