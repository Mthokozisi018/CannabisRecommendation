"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { getProductImage, isUsableProductImageUrl } from "@/lib/product-images";
import type { ReceptionistProduct } from "@/lib/receptionist/products";
import { getStaticStrainProfileForProduct, type StaticStrainProfileKey } from "@/lib/strain-profiles";

type OverlayPosition = {
  left: string;
  top: string;
  width: string;
  height: string;
};

type ModularConfig = {
  src: string;
  aspectRatio: string;
  heightConstrainedWidth: string;
  productImage: OverlayPosition;
  productName: OverlayPosition;
  close: OverlayPosition;
};

const sharedPositions = {
  productImage: { left: "2.7%", top: "3.2%", width: "165px", height: "195px" },
  productName: { left: "21.25%", top: "7.65%", width: "40.7%", height: "8.15%" },
  close: { left: "94.05%", top: "2.25%", width: "4.15%", height: "7.35%" }
} satisfies Record<"productImage" | "productName" | "close", OverlayPosition>;

const flowerCultivationImages: Record<string, string> = {
  indoor: "/assets/flower-modals/indoor.png",
  greenhouse: "/assets/flower-modals/greenhouse.png",
  outdoor: "/assets/flower-modals/outdoor.png"
};

const preRollCultivationImages: Record<string, string> = {
  indoor: "/products/prerolls/modulars/preroll-indoor-modular.png",
  greenhouse: "/products/prerolls/modulars/preroll-greenhouse-modular.png",
  outdoor: "/products/prerolls/modulars/preroll-outdoor-modular.png"
};

const flowerImageCropScale: Record<string, number> = {
  indoor: 1.2,
  greenhouse: 1.2,
  outdoor: 1.42
};

const edibleModular = {
  src: "/assets/edibles/New Edible Table.png",
  aspectRatio: "1536 / 1024",
  guideAspectRatio: "1672 / 941",
  heightConstrainedWidth: "calc((100dvh - 96px) * 1.5)",
  productImage: { left: "9.55%", top: "3.5%", width: "16.15%", height: "27.1%" },
  productName: { left: "9.55%", top: "34.15%", width: "16.05%", height: "3.65%" },
  subcategory: { left: "9.55%", top: "41.35%", width: "16.05%", height: "3.65%" },
  thcPerUnit: { left: "11.05%", top: "54.35%", width: "5.5%", height: "4.15%" },
  thcPerPacket: { left: "11.05%", top: "67.55%", width: "5.5%", height: "4.15%" },
  packageCount: { left: "11.6%", top: "74.9%", width: "1.4%", height: "2.65%" },
  close: { left: "88.45%", top: "2.75%", width: "3.75%", height: "6.75%" }
} as const;

export const productModulars: Record<StaticStrainProfileKey, ModularConfig> = {
  sativa: {
    src: "/modulars/sativa-flower-modular.png",
    aspectRatio: "1683 / 935",
    heightConstrainedWidth: "147.6dvh",
    ...sharedPositions,
    productImage: { left: "4.1%", top: "3.2%", width: "165px", height: "195px" },
    productName: { left: "22.25%", top: "6.8%", width: "40.55%", height: "8.6%" }
  },
  indica: {
    src: "/modulars/indica-flower-modular.png",
    aspectRatio: "1672 / 941",
    heightConstrainedWidth: "145.7dvh",
    ...sharedPositions,
    productName: { left: "21.25%", top: "8.55%", width: "40.7%", height: "8.05%" },
    close: { left: "94.05%", top: "2.75%", width: "4.15%", height: "7.35%" }
  },
  hybrid: {
    src: "/modulars/hybrid-flower-modular.png",
    aspectRatio: "1672 / 941",
    heightConstrainedWidth: "145.7dvh",
    ...sharedPositions,
    close: { left: "94.05%", top: "2.75%", width: "4.15%", height: "7.35%" }
  }
};

function positionStyle(position: OverlayPosition): CSSProperties {
  return position;
}

function productImageFrameStyle(position: OverlayPosition): CSSProperties {
  return {
    ...position,
    width: `min(${position.width}, calc(100cqw - 16px))`,
    height: `min(${position.height}, calc(100cqw - 16px))`
  };
}

function normalizedKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isFlowerProduct(product: ReceptionistProduct) {
  return normalizedKey(product.categorySlug || product.categoryName) === "flower";
}

function isPreRollProduct(product: ReceptionistProduct) {
  return normalizedKey(product.categorySlug || product.categoryName) === "prerolls";
}

function flowerImageFitStyle(product: ReceptionistProduct): CSSProperties {
  const scale = flowerImageCropScale[normalizedKey(product.cultivationType)] ?? 1.2;
  return { transform: `scale(${scale})` };
}

function modalProductImage(product: ReceptionistProduct) {
  if (isFlowerProduct(product)) {
    return flowerCultivationImages[normalizedKey(product.cultivationType)] ?? "";
  }

  if (isPreRollProduct(product)) {
    return preRollCultivationImages[normalizedKey(product.cultivationType)] ?? "";
  }

  if (normalizedKey(product.categorySlug || product.categoryName) === "edibles") {
    return getProductImage(product);
  }

  const imageUrl = product.imageUrl?.trim() ?? "";
  return isUsableProductImageUrl(imageUrl) ? imageUrl : "";
}

export function formatEdibleMg(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 4 }).format(value);
}

function edibleUploadedImage(product: ReceptionistProduct) {
  const imageUrl = product.imageUrl?.trim() ?? "";
  return isUsableProductImageUrl(imageUrl) ? imageUrl : "";
}

function formatPiecesPerPack(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 1) return "";
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(value);
}

export function resolveProductModularKind(product: ReceptionistProduct): StaticStrainProfileKey | "edible" | "generic" {
  if (normalizedKey(product.categorySlug || product.categoryName) === "edibles") return "edible";
  return getStaticStrainProfileForProduct(product)?.key ?? "generic";
}

function GenericProductDialog({ product, onClose }: { product: ReceptionistProduct; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="w-full max-w-lg rounded-2xl border border-emerald-400/25 bg-[#06130d] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-emerald-300">{product.categoryName}</p>
            <h2 id={titleId} className="mt-1 text-2xl font-extrabold">{product.name}</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full border border-white/30 text-2xl leading-none transition hover:bg-white/10" aria-label="Close product information">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <p className="text-white/74">{product.subcategory || "Product information"}</p>
      </div>
    </div>
  );
}

export function ProductDescriptionModal({ product, onClose }: { product: ReceptionistProduct | null; onClose: () => void }) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const staticProfile = product ? getStaticStrainProfileForProduct(product) : null;
  const modularKind = product ? resolveProductModularKind(product) : "generic";
  const productImage = product ? modalProductImage(product) : "";
  const hasProductImage = isUsableProductImageUrl(productImage);
  const imageVisible = hasProductImage && failedImageUrl !== productImage;
  const edibleProductImage = product ? edibleUploadedImage(product) : "";
  const edibleImageVisible = isUsableProductImageUrl(edibleProductImage) && failedImageUrl !== edibleProductImage;
  const ediblePiecesPerPack = product ? formatPiecesPerPack(product.packageCount) : "";
  const flowerModal = product ? isFlowerProduct(product) : false;
  const preRollModal = product ? isPreRollProduct(product) : false;

  useEffect(() => {
    if (!product) return;

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [onClose, product]);

  if (!product) return null;

  if (modularKind === "edible") {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-black/75 p-4 text-white backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div
          className="relative max-w-full overflow-hidden rounded-[clamp(8px,1.1vw,18px)] shadow-2xl [container-type:inline-size]"
          style={{ aspectRatio: edibleModular.aspectRatio, width: `min(calc(100vw - 64px), 980px, ${edibleModular.heightConstrainedWidth})` }}
        >
          <div className="absolute inset-0 grid place-items-center bg-[#020604]">
            <div className="relative w-full max-w-full overflow-hidden [container-type:inline-size]" style={{ aspectRatio: edibleModular.guideAspectRatio }}>
              {/* The guide artwork supplies the fixed dosage table; product-specific fields are layered into its blank areas. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={edibleModular.src} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full select-none object-contain" fetchPriority="high" />

              {edibleImageVisible ? (
                <div className="absolute overflow-hidden rounded-[8%]" style={positionStyle(edibleModular.productImage)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={edibleProductImage} alt={`${product.name} product image`} className="block size-full object-contain object-center p-[1.5%]" onError={() => setFailedImageUrl(edibleProductImage)} />
                </div>
              ) : null}

              <h2 id={titleId} className="absolute flex items-center justify-center overflow-hidden px-[0.55cqw] text-center text-[clamp(0.46rem,1.12cqw,1rem)] font-black leading-tight text-white" style={positionStyle(edibleModular.productName)} title={product.name}>
                <span className="line-clamp-1 break-words">{product.name}</span>
              </h2>
              <p className="absolute flex items-center justify-center overflow-hidden px-[0.55cqw] text-center text-[clamp(0.4rem,0.98cqw,0.86rem)] font-bold leading-tight text-[#9bd321]" style={positionStyle(edibleModular.subcategory)}>
                <span className="truncate">{product.subcategory || "--"}</span>
              </p>
              <p className="absolute flex items-center justify-center overflow-hidden text-center text-[clamp(0.42rem,1.05cqw,0.86rem)] font-black leading-none text-white tabular-nums" style={positionStyle(edibleModular.thcPerUnit)} aria-label={`THC per serving: ${formatEdibleMg(product.thcPerUnitMg)} milligrams`}>
                {formatEdibleMg(product.thcPerUnitMg)}
              </p>
              <p className="absolute flex items-center justify-center overflow-hidden text-center text-[clamp(0.42rem,1.05cqw,0.86rem)] font-black leading-none text-white tabular-nums" style={positionStyle(edibleModular.thcPerPacket)} aria-label={`THC per packet: ${formatEdibleMg(product.thcPerPacketMg)} milligrams`}>
                {formatEdibleMg(product.thcPerPacketMg)}
              </p>
              {ediblePiecesPerPack ? (
                <p className="absolute flex items-center justify-center overflow-hidden text-center text-[clamp(0.32rem,0.92cqw,0.62rem)] font-black leading-none text-white tabular-nums" style={positionStyle(edibleModular.packageCount)} aria-label={`Pieces per pack: ${ediblePiecesPerPack}`}>
                  {ediblePiecesPerPack}
                </p>
              ) : null}

              <button ref={closeButtonRef} type="button" onClick={onClose} className="absolute rounded-full bg-transparent text-transparent outline-none focus-visible:ring-[clamp(2px,0.3cqw,4px)] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/70" style={positionStyle(edibleModular.close)} aria-label="Close product information" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!staticProfile) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`No strain modular is available for ${product.categoryName} / ${product.subcategory}. Using the generic product dialog.`);
    }
    return <GenericProductDialog product={product} onClose={onClose} />;
  }

  const modular = productModulars[staticProfile.key];

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-black/75 p-4 text-white backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className="relative max-w-full overflow-hidden rounded-[clamp(8px,1.1vw,18px)] shadow-2xl [container-type:inline-size]"
        style={{ aspectRatio: modular.aspectRatio, width: `min(calc(100vw - 32px), 1050px, ${modular.heightConstrainedWidth})` }}
      >
          {/* The supplied modular is decorative; all live data and controls are rendered separately. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={modular.src} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full select-none object-contain" fetchPriority="high" />

          <h2
            id={titleId}
            className="absolute flex items-center overflow-hidden px-[1.1cqw] text-[clamp(0.68rem,2.35cqw,1.75rem)] font-black leading-[1.05] text-white drop-shadow-[0_3px_7px_rgba(0,0,0,0.9)]"
            style={positionStyle(modular.productName)}
            title={product.name}
          >
            <span className="line-clamp-2 break-words">{product.name}</span>
          </h2>

          {imageVisible ? (
            <div className="absolute grid aspect-square place-items-center overflow-hidden rounded-[10%] bg-black/45" style={productImageFrameStyle(modular.productImage)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productImage}
                alt={`${product.name} product image`}
                className={flowerModal || preRollModal ? "block size-full object-cover object-center" : "block size-full object-contain object-center p-[2%]"}
                style={flowerModal ? flowerImageFitStyle(product) : undefined}
                onError={() => setFailedImageUrl(productImage)}
              />
            </div>
          ) : null}

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute rounded-full bg-transparent text-transparent outline-none focus-visible:ring-[clamp(2px,0.3cqw,4px)] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/70"
            style={positionStyle(modular.close)}
            aria-label="Close product information"
          />
      </div>
    </div>
  );
}
