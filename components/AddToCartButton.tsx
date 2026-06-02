"use client";

import { Plus } from "lucide-react";
import type { ProductDTO } from "@/lib/types";

export function AddToCartButton({ product }: { product: ProductDTO }) {
  return (
    <button
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-mint px-4 font-semibold text-ink"
      onClick={() => window.dispatchEvent(new CustomEvent("greenchoice:add-to-cart", { detail: product }))}
    >
      <Plus size={18} /> Add to draft
    </button>
  );
}
