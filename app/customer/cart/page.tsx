import { CustomerCurrentOrder } from "@/components/customer/CustomerCurrentOrder";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { requireCustomerSession } from "@/lib/customer/auth";
import { readCustomerCart } from "@/lib/customer/cart";
import { getCustomerStore } from "@/lib/customer/catalog";

export const metadata = { title: "Cart | GreenChoice" };

export default async function CustomerCartPage() {
  const session = await requireCustomerSession();
  const cart = await readCustomerCart(session.user.id);
  const store = cart.storeId ? await getCustomerStore(cart.storeId) : null;
  return <main className="min-h-screen">
    <CustomerHeader backHref="/customer/shop" backLabel="Back to Shop" />
    <section className="border-y border-[#253029] bg-[#08110b]"><div className="mx-auto max-w-6xl px-4 py-7 sm:px-6"><h1 className="text-3xl font-black sm:text-4xl">Cart</h1><p className="mt-2 text-[#a7b1a9]">Review your products and choose how to receive your order.</p></div></section>
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><CustomerCurrentOrder fulfillment={store?.fulfillment ?? null} /></section>
  </main>;
}
