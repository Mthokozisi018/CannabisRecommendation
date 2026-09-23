"use client";

import Image, { type ImageLoader } from "next/image";

const passthroughLoader: ImageLoader = ({ src }) => src;

export function CustomerImage({
  src,
  alt,
  sizes,
  className,
  priority = false,
  onError,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  onError?: () => void;
}) {
  return <Image loader={passthroughLoader} unoptimized src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} onError={onError} />;
}
