"use client";

import type { ReceptionistProduct } from "@/lib/receptionist/products";
import { ProductCard } from "@/components/receptionist/pos/ProductCard";

export function ProductGrid({
  products,
  onAddToCart,
  onOpenDescription
}: {
  products: ReceptionistProduct[];
  onAddToCart: (product: ReceptionistProduct) => void;
  onOpenDescription: (productId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[repeat(2,minmax(240px,300px))] lg:grid-cols-[repeat(3,minmax(240px,300px))]">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} onOpenDescription={onOpenDescription} visualStyle="solid-shading" />
      ))}
    </div>
  );
}
