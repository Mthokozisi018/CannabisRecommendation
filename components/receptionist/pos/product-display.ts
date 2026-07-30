import { getPreRollCultivationCardImage, getProductImage } from "@/lib/product-images";
import type { ReceptionistProduct } from "@/lib/receptionist/products";

export function getPOSProductImage(product: ReceptionistProduct) {
  return getPreRollCultivationCardImage(product) ?? getProductImage(product);
}

export function getPOSProductCartDetails(product: ReceptionistProduct) {
  return {
    name: product.name,
    categoryName: product.categoryName,
    subcategory: product.subcategory,
    imageSrc: getPOSProductImage(product),
    unitPrice: product.sellingPrice,
    stockAvailable: product.quantityAvailable,
    sizeLabel: product.sizeLabel
  };
}
