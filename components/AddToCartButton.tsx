import { Plus } from "lucide-react";
import { addToCartAction } from "@/app/actions";
import type { ProductDTO } from "@/lib/types";

export function AddToCartButton({ product }: { product: ProductDTO }) {
  return (
    <form action={addToCartAction}>
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="quantity" value="1" />
      <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-mint px-4 font-semibold text-ink focus:outline focus:outline-2 focus:outline-white">
        <Plus size={18} /> Add to draft
      </button>
    </form>
  );
}
