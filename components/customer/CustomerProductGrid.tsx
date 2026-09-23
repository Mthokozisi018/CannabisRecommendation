"use client";

import { useState } from "react";
import { ProductCard } from "@/components/receptionist/pos/ProductCard";
import { ProductDescriptionModal } from "@/components/receptionist/pos/ProductDescriptionModal";
import { useCustomerCart } from "@/components/customer/CustomerCartProvider";
import type { ReceptionistProduct } from "@/lib/receptionist/products";

const ADD_TO_CART_FEEDBACK_MS = 3200;

export function CustomerProductGrid({ products, storeId }: { products: ReceptionistProduct[]; storeId: string }) {
  const { addProduct, busy, message, clearMessage } = useCustomerCart();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;

  async function addToCart(product: ReceptionistProduct) {
    const added = await addProduct(product.id, storeId);
    if (!added) return;
    setAddedProductId(product.id);
    globalThis.setTimeout(() => {
      setAddedProductId((current) => current === product.id ? null : current);
    }, ADD_TO_CART_FEEDBACK_MS);
  }

  return (
    <>
      {message ? <button type="button" onClick={clearMessage} className="mb-4 w-full rounded-md border border-[#7b3933] bg-[#24100e] px-4 py-3 text-left text-sm font-bold text-[#ffaaa2]" aria-label="Dismiss cart message">{message}</button> : null}
      <div aria-busy={busy} className="gc-pos-product-grid grid grid-cols-2 items-stretch gap-3 sm:grid-cols-[repeat(2,minmax(240px,300px))] lg:grid-cols-[repeat(3,minmax(240px,300px))] xl:grid-cols-[repeat(4,minmax(240px,300px))] 2xl:grid-cols-[repeat(5,minmax(240px,300px))]">
        {products.map((product) => <ProductCard key={product.id} product={product} onAddToCart={(item) => void addToCart(item)} onOpenDescription={setSelectedProductId} addFeedback={addedProductId === product.id} visualStyle="solid-shading" />)}
      </div>
      <ProductDescriptionModal product={selectedProduct} onClose={() => setSelectedProductId(null)} />
    </>
  );
}
