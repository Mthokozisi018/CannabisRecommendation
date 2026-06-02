import Link from "next/link";
import { listRecommendedProducts } from "@/lib/dal/catalog";
import { money } from "@/lib/services/format";

export default async function AdminProductsPage() {
  const products = await listRecommendedProducts("relaxed");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Catalog QA</h1>
        <Link href="/admin/import" className="rounded-lg bg-mint px-4 py-2 text-sm font-semibold text-ink">Import JSON</Link>
      </div>
      <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.06] text-white/60"><tr><th className="p-3">Product</th><th>Category</th><th>Stock</th><th>Price</th><th>Flags</th></tr></thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-white/10">
                <td className="p-3"><Link href={`/products/${product.slug}`} className="text-mint">{product.name}</Link><div className="text-white/45">{product.brand}</div></td>
                <td>{product.categoryName}</td>
                <td>{product.stockStatus}</td>
                <td>{money(product.priceCents)}</td>
                <td>{[product.isNew && "new", product.isOnSpecial && "sale", product.isLabTested && "lab"].filter(Boolean).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
