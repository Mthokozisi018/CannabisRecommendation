export const STORE_IMAGE_PLACEHOLDER = "/images/store-image-coming-soon.png";

export function usableStoreImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
