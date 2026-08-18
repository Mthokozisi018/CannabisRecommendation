"use client";

import { useState } from "react";
import { ProductCard } from "@/components/receptionist/pos/ProductCard";
import { ProductDescriptionModal } from "@/components/receptionist/pos/ProductDescriptionModal";
import { useCustomerCart } from "@/components/customer/CustomerCartProvider";
import type { ReceptionistProduct } from "@/lib/receptionist/products";
import { FavouriteButton } from "@/components/customer/FavouriteButton";

export function CustomerProductGrid({ products, savedProductIds = [] }: { products: ReceptionistProduct[]; savedProductIds?: string[] }) {
  const { addProduct, busy, message, clearMessage } = useCustomerCart();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;

  return (
    <>
      {message ? <button type="button" onClick={clearMessage} className="mb-4 w-full rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-bold text-red-700" aria-label="Dismiss cart message">{message}</button> : null}
      <div aria-busy={busy} className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-[repeat(2,minmax(240px,300px))] lg:grid-cols-[repeat(3,minmax(240px,300px))]">
        {products.map((product) => <div key={product.id} className="relative"><FavouriteButton targetType="product" targetId={product.id} initiallySaved={savedProductIds.includes(product.id)} className="absolute left-3 top-3 z-10 size-9 border-white/60 bg-black/55 text-white" /><ProductCard product={product} onAddToCart={() => void addProduct(product.id)} onOpenDescription={setSelectedProductId} visualStyle="solid-shading" /></div>)}
      </div>
      <ProductDescriptionModal product={selectedProduct} onClose={() => setSelectedProductId(null)} />
    </>
  );
}
