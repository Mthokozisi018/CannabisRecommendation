import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductDescriptionModal, productModulars } from "@/components/receptionist/pos/ProductDescriptionModal";
import type { ReceptionistProduct } from "@/lib/receptionist/products";

const baseProduct: ReceptionistProduct = {
  id: "product-1",
  name: "Apollo",
  categoryName: "Flower",
  categorySlug: "flower",
  subcategory: "Sativa",
  cultivationType: "Indoor",
  description: "Manager-written flower description.",
  imageUrl: "/images/products/apollo.png",
  imagePath: null,
  sizeLabel: "3.5 g",
  strainType: "Sativa",
  sellingPrice: 120,
  productStatus: "active",
  isActive: true,
  isNew: false,
  quantityAvailable: 10,
  lowStockThreshold: 2
};

describe("ProductDescriptionModal", () => {
  it("renders the exact Sativa modular image for Sativa products", () => {
    const markup = renderToStaticMarkup(<ProductDescriptionModal product={baseProduct} onClose={() => undefined} />);

    expect(markup).toContain("/modulars/sativa-flower-modular.png");
    expect(markup).toContain("Apollo");
    expect(markup).toContain("/assets/flower-modals/indoor.png");
    expect(markup).not.toContain("Common Effects Reported By Users");
    expect(markup).not.toContain("Best Time To Use");
    expect(markup).not.toContain("Start low and go slow.");
    expect(markup).not.toContain("Manager-written flower description.");
  });

  it("renders the matching Indica and Hybrid modular images", () => {
    const indicaMarkup = renderToStaticMarkup(<ProductDescriptionModal product={{ ...baseProduct, subcategory: "Indica", strainType: "Indica" }} onClose={() => undefined} />);
    const hybridMarkup = renderToStaticMarkup(<ProductDescriptionModal product={{ ...baseProduct, subcategory: "Hybrid", strainType: "Hybrid" }} onClose={() => undefined} />);

    expect(indicaMarkup).toContain("/modulars/indica-flower-modular.png");
    expect(hybridMarkup).toContain("/modulars/hybrid-flower-modular.png");
  });

  it("renders only the modular image for Vape Cartridges", () => {
    const markup = renderToStaticMarkup(
      <ProductDescriptionModal
        product={{
          ...baseProduct,
          categoryName: "Vape Cartridges",
          categorySlug: "vape-cartridges",
          subcategory: "Hybrid",
          strainType: "Hybrid",
          cultivationType: "Indoor",
          name: "Apollo Vape",
          description: "Selected vape cartridge description."
        }}
        onClose={() => undefined}
      />
    );

    expect(markup).toContain("/modulars/hybrid-flower-modular.png");
    expect(markup).toContain("Apollo Vape");
    expect(markup).toContain("/images/products/apollo.png");
    expect(markup).not.toContain("Vape Cartridges");
    expect(markup).not.toContain("Selected vape cartridge description.");
    expect(markup).not.toContain(">Cultivation</span>");
  });

  it("renders only the modular image for Pre-Rolls", () => {
    const markup = renderToStaticMarkup(
      <ProductDescriptionModal
        product={{
          ...baseProduct,
          categoryName: "Pre-Rolls",
          categorySlug: "pre-rolls",
          subcategory: "Indica",
          strainType: "Indica",
          cultivationType: "Greenhouse",
          name: "Moon Mint Pre-Roll",
          description: "Selected pre-roll description."
        }}
        onClose={() => undefined}
      />
    );

    expect(markup).toContain("/modulars/indica-flower-modular.png");
    expect(markup).toContain("Moon Mint Pre-Roll");
    expect(markup).toContain("/products/prerolls/modulars/preroll-greenhouse-modular.png");
    expect(markup).toContain("width:min(165px, calc(100cqw - 16px))");
    expect(markup).toContain("height:min(195px, calc(100cqw - 16px))");
    expect(markup).toContain("block size-full object-cover object-center");
    expect(markup).not.toContain("Pre-Rolls");
    expect(markup).not.toContain("Greenhouse");
    expect(markup).not.toContain("Selected pre-roll description.");
  });

  it.each([
    [" Indoor ", "preroll-indoor-modular.png"],
    ["GREENHOUSE", "preroll-greenhouse-modular.png"],
    ["outdoor", "preroll-outdoor-modular.png"]
  ])("maps Pre-Rolls cultivation type %s to %s in the Flower-sized modular frame", (cultivationType, expectedImage) => {
    const markup = renderToStaticMarkup(
      <ProductDescriptionModal
        product={{
          ...baseProduct,
          categoryName: "Pre-Rolls",
          categorySlug: "pre-rolls",
          cultivationType
        }}
        onClose={() => undefined}
      />
    );

    expect(markup).toContain(`/products/prerolls/modulars/${expectedImage}`);
    expect(markup).toContain("width:min(165px, calc(100cqw - 16px))");
    expect(markup).toContain("height:min(195px, calc(100cqw - 16px))");
    expect(markup).toContain("block size-full object-cover object-center");
  });

  it("preserves the existing Pre-Rolls modular image fallback for an unexpected cultivation type", () => {
    const markup = renderToStaticMarkup(
      <ProductDescriptionModal
        product={{
          ...baseProduct,
          categoryName: "Pre-Rolls",
          categorySlug: "pre-rolls",
          cultivationType: "Hydro"
        }}
        onClose={() => undefined}
      />
    );

    expect(markup).not.toContain('alt="Apollo product image"');
    expect(markup).not.toContain("/products/prerolls/modulars/preroll-");
  });

  it("preserves each supplied modular's native aspect ratio", () => {
    const markup = renderToStaticMarkup(<ProductDescriptionModal product={baseProduct} onClose={() => undefined} />);

    expect(markup).toContain("min(calc(100vw - 32px), 1050px, 147.6dvh)");
    expect(markup).toContain("aspect-square");
    expect(markup).toContain("place-items-center");
    expect(markup).toContain("overflow-hidden");
    expect(markup).toContain("width:min(165px, calc(100cqw - 16px))");
    expect(markup).toContain("height:min(195px, calc(100cqw - 16px))");
    expect(markup).toContain("object-contain");
    expect(markup).toContain("object-cover");
    expect(markup).toContain("object-center");
    expect(markup).toContain("1683 / 935");
    expect(productModulars.indica.aspectRatio).toBe("1672 / 941");
    expect(productModulars.hybrid.aspectRatio).toBe("1672 / 941");
  });

  it("uses the approved fit inside the same image frame for cultivation placeholders and uploaded images", () => {
    const flowerMarkup = renderToStaticMarkup(<ProductDescriptionModal product={baseProduct} onClose={() => undefined} />);
    const uploadedMarkup = renderToStaticMarkup(
      <ProductDescriptionModal
        product={{
          ...baseProduct,
          categoryName: "Vape Cartridges",
          categorySlug: "vape-cartridges",
          subcategory: "Hybrid",
          strainType: "Hybrid",
          name: "Apollo Vape",
          imageUrl: "/images/products/apollo.png"
        }}
        onClose={() => undefined}
      />
    );

    expect(flowerMarkup).toContain("/assets/flower-modals/indoor.png");
    expect(flowerMarkup).toContain("block size-full object-cover object-center");
    expect(uploadedMarkup).toContain("/images/products/apollo.png");
    expect(uploadedMarkup).toContain("block size-full object-contain object-center");
  });

  it("leaves the supplied image placeholder visible when the product has no image", () => {
    const markup = renderToStaticMarkup(<ProductDescriptionModal product={{ ...baseProduct, cultivationType: null, imageUrl: null }} onClose={() => undefined} />);

    expect(markup).toContain("/modulars/sativa-flower-modular.png");
    expect(markup).not.toContain("product image");
  });

  it.each([
    [" Indoor ", "indoor.png"],
    ["GREENHOUSE", "greenhouse.png"],
    ["outdoor", "outdoor.png"]
  ])("maps Flower cultivation type %s to %s", (cultivationType, expectedImage) => {
    const markup = renderToStaticMarkup(<ProductDescriptionModal product={{ ...baseProduct, cultivationType }} onClose={() => undefined} />);

    expect(markup).toContain(`/assets/flower-modals/${expectedImage}`);
  });

  it("uses one accessible transparent close control over the supplied X artwork", () => {
    const markup = renderToStaticMarkup(<ProductDescriptionModal product={baseProduct} onClose={() => undefined} />);

    expect(markup).toContain('aria-label="Close product information"');
    expect(markup).not.toContain("lucide-x");
  });

  it("uses the standard edible modular with dynamic edible product details", () => {
    const markup = renderToStaticMarkup(
      <ProductDescriptionModal
        product={{
          ...baseProduct,
          categoryName: "Edibles",
          categorySlug: "edibles",
          subcategory: "Gummies",
          description: "Manager-written edible description.",
          thcPerUnitMg: 5.5,
          thcPerPacketMg: 55
        }}
        onClose={() => undefined}
      />
    );

    expect(markup).toContain("/assets/edibles/New Edible Table.png");
    expect(markup).toContain("min(calc(100vw - 64px), 980px");
    expect(markup).toContain("calc((100dvh - 96px) * 1.5)");
    expect(markup).toContain("Apollo");
    expect(markup).toContain("Gummies");
    expect(markup).toContain(">5,5</p>");
    expect(markup).toContain(">55</p>");
    expect(markup).not.toContain("mg THC");
    expect(markup).toContain("/images/products/apollo.png");
    expect(markup).not.toContain("Manager-written edible description.");
    expect(markup).not.toContain("-flower-modular.png");
  });

  it("shows neutral placeholders for legacy edible products without THC values", () => {
    const markup = renderToStaticMarkup(
      <ProductDescriptionModal
        product={{ ...baseProduct, categoryName: "Edibles", categorySlug: "edibles", subcategory: "Brownies", imageUrl: null, thcPerUnitMg: null, thcPerPacketMg: null }}
        onClose={() => undefined}
      />
    );

    expect(markup).toContain("/assets/edibles/New Edible Table.png");
    expect(markup).toContain("Brownies");
    expect(markup.match(/>--<\/p>/g)).toHaveLength(2);
    expect(markup).not.toContain("undefined");
    expect(markup).not.toContain("NaN");
  });
});
