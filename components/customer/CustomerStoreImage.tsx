"use client";

import { useState } from "react";
import { CustomerImage } from "@/components/customer/CustomerImage";
import { STORE_IMAGE_PLACEHOLDER, usableStoreImageUrl } from "@/lib/customer/store-images";

export function CustomerStoreImage({
  src,
  alt,
  sizes,
  className,
  priority = false,
}: {
  src?: string | null;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const initialSrc = usableStoreImageUrl(src) ?? STORE_IMAGE_PLACEHOLDER;
  const [imageSrc, setImageSrc] = useState(initialSrc);

  return (
    <CustomerImage
      src={imageSrc}
      alt={alt}
      sizes={sizes}
      className={className}
      priority={priority}
      onError={() => {
        if (imageSrc !== STORE_IMAGE_PLACEHOLDER) setImageSrc(STORE_IMAGE_PLACEHOLDER);
      }}
    />
  );
}
