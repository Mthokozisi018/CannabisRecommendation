"use client";

import type { ReceptionistProduct } from "@/lib/receptionist/products";
import { ProductCard } from "@/components/receptionist/pos/ProductCard";

export function ProductGrid({
  products,
  onAddToCart,
  onOpenDescription,
  addedProductId
}: {
  products: ReceptionistProduct[];
  onAddToCart: (product: ReceptionistProduct) => void;
  onOpenDescription: (productId: string) => void;
  addedProductId: string | null;
}) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[repeat(2,minmax(240px,300px))] lg:grid-cols-[repeat(3,minmax(240px,300px))]">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} onOpenDescription={onOpenDescription} addFeedback={addedProductId === product.id} visualStyle="solid-shading" />
      ))}
    </div>
  );
}
