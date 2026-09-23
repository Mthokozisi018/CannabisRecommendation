import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { SelectedStoreInfoBlock } from "@/components/customer/SelectedStoreInfoBlock";
import { CustomerStoreCatalog } from "@/components/customer/CustomerStoreCatalog";
import {
  deriveCustomerCategories,
  getCustomerStore,
  listCustomerProducts,
  recordCustomerStoreView,
} from "@/lib/customer/catalog";

export default async function CustomerStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ storeId }, query] = await Promise.all([params, searchParams]);
  const [store, products] = await Promise.all([
    getCustomerStore(storeId),
    listCustomerProducts({ storeId }),
  ]);
  if (!store) notFound();
  await recordCustomerStoreView(storeId);

  const categories = deriveCustomerCategories(products);
  const selectedCategory =
    query.category &&
    categories.some((category) => category.slug === query.category)
      ? query.category
      : categories[0]?.slug;

  return (
    <main className="gc-pos-page mx-auto flex min-h-screen max-w-[1920px] flex-col px-4 py-3 text-white sm:px-6">
      <header className="gc-pos-header grid gap-0 border-b border-white/10 pb-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="flex justify-start">
          <Link href="/customer/stores" className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-[#050b08] px-4 text-sm font-bold text-white shadow-[0_0_20px_rgba(34,197,94,0.14),0_10px_28px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-emerald-300/75 hover:bg-[#07130d] hover:text-lime-200 hover:shadow-[0_0_26px_rgba(34,197,94,0.25),0_10px_28px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.07)] focus-visible:ring-2 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503]" aria-label="Back to stores">
            <ArrowLeft size={17} />
            Back to Stores
          </Link>
        </div>
        <div className="gc-pos-logo-wrap flex justify-center">
          <Image
            src="/branding/greenchoice-logo.png"
            alt={`${store.name} GreenChoice logo`}
            width={1028}
            height={307}
            priority
            className="gc-pos-logo h-20 w-[min(30cm,calc(100vw-2rem))] object-contain sm:h-24 sm:w-[min(30cm,58vw)] lg:h-28"
          />
        </div>
        <div aria-hidden="true" />
      </header>

      <section className="min-w-0 flex-1 py-3">
        <SelectedStoreInfoBlock store={store} />
        {categories.length ? (
          <CustomerStoreCatalog
            products={products}
            categories={categories}
            initialCategory={selectedCategory}
            storeId={store.id}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/14 bg-white/[0.04] p-8 text-center">
            <p className="text-2xl font-extrabold">No products available yet.</p>
            <p className="mt-2 text-white/62">Products added by the store will appear here.</p>
          </div>
        )}
      </section>
    </main>
  );
}
