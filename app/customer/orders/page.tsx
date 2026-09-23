import Link from "next/link";
import { Clock3, History, MapPin, ShoppingBag } from "lucide-react";
import { CustomerCurrentOrder } from "@/components/customer/CustomerCurrentOrder";
import { CustomerEmptyState } from "@/components/customer/CustomerEmptyState";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CustomerOrderCard } from "@/components/customer/CustomerOrderCard";
import { requireCustomerSession } from "@/lib/customer/auth";
import { readCustomerCart } from "@/lib/customer/cart";
import { getCustomerStore } from "@/lib/customer/catalog";
import { isCurrentOrder, listCustomerOrders } from "@/lib/customer/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders | GreenChoice" };

const views = [
  { value: "current", label: "Current Order", Icon: ShoppingBag },
  { value: "track", label: "Track Order", Icon: MapPin },
  { value: "history", label: "Order History", Icon: History }
] as const;

export default async function CustomerOrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string }> }) {
  const query = await searchParams;
  const view = views.some((item) => item.value === query.view) ? query.view! : "current";
  const session = await requireCustomerSession();
  const [orders, cart] = await Promise.all([listCustomerOrders(), readCustomerCart(session.user.id)]);
  const store = cart.storeId ? await getCustomerStore(cart.storeId) : null;
  const activeOrders = orders.filter((order) => isCurrentOrder(order.status));
  const historyOrders = orders.filter((order) => !isCurrentOrder(order.status));
  const status = ["completed", "cancelled", "refunded"].includes(query.status ?? "") ? query.status : "all";
  const filteredHistory = status === "all" ? historyOrders : historyOrders.filter((order) => status === "completed" ? ["completed", "collected", "delivered"].includes(order.status) : order.status === status);

  return (
    <main className="min-h-screen">
      <CustomerHeader backHref="/customer" backLabel="Back to home" />
      <section className="border-y border-[#253029] bg-[#08110b]"><div className="mx-auto max-w-6xl px-4 py-7 sm:px-6"><h1 className="text-3xl font-black sm:text-4xl">Orders</h1><p className="mt-2 text-[#a7b1a9]">Review your cart, track active orders, and view order history.</p></div></section>
      <nav className="mx-auto mt-5 grid max-w-6xl grid-cols-3 border border-[#303d34] bg-[#08100b]" aria-label="Order views">{views.map(({ value, label, Icon }) => <Link key={value} href={`/customer/orders?view=${value}`} className={`flex min-h-14 min-w-0 items-center justify-center gap-2 border-b-2 px-2 text-center text-xs font-bold sm:text-sm ${view === value ? "border-[#a7e627] bg-[#111d0a] text-[#b3ed39]" : "border-transparent text-[#aeb7b0]"}`}><Icon size={18} className="hidden sm:block" />{label}</Link>)}</nav>
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {view === "current" ? <CustomerCurrentOrder fulfillment={store?.fulfillment ?? null} /> : null}
        {view === "track" ? activeOrders.length ? <div className="grid gap-4">{activeOrders.map((order) => <CustomerOrderCard key={order.id} order={order} />)}</div> : <CustomerEmptyState Icon={Clock3} title="No active orders" message="Orders being prepared, awaiting collection, or out for delivery will appear here." href="/customer/stores" action="Browse stores" /> : null}
        {view === "history" ? <><nav className="mb-5 flex gap-2 overflow-x-auto" aria-label="History filters">{[["all", "All orders"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["refunded", "Refunded"]].map(([value, label]) => <Link key={value} href={`/customer/orders?view=history&status=${value}`} className={`whitespace-nowrap border px-4 py-2 text-sm font-bold ${status === value ? "border-[#a7e627] bg-[#a7e627] text-[#081000]" : "border-[#354238] bg-[#09110c]"}`}>{label}</Link>)}</nav>{filteredHistory.length ? <div className="grid gap-4">{filteredHistory.map((order) => <CustomerOrderCard key={order.id} order={order} />)}</div> : <CustomerEmptyState Icon={History} title="No order history" message="Completed, cancelled, refunded, and expired orders will appear here." />}</> : null}
      </section>
    </main>
  );
}
