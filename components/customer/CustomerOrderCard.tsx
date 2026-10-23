import Link from "next/link";
import { Bike, ChevronRight, ShoppingBag } from "lucide-react";
import type { CustomerOrderSummary } from "@/lib/customer/orders";
import { CustomerImage } from "@/components/customer/CustomerImage";

const money = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});
const dateTime = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Johannesburg",
});

export function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Order placed",
    placed: "Order placed",
    confirmed: "Order accepted",
    preparing: "Preparing",
    ready_for_collection: "Ready for collection",
    out_for_delivery: "Out for delivery",
    completed: "Completed",
    collected: "Collected",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
    forfeited: "Expired",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function CustomerOrderCard({ order }: { order: CustomerOrderSummary }) {
  return (
    <article className="border border-[#2b3730] bg-[#08100b]">
      <Link
        href={`/customer/orders/${order.id}` as never}
        className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-[#547322] bg-[#111d09] px-2 py-1 text-xs font-bold text-[#b0e63f]">
              {orderStatusLabel(order.status)}
            </span>
            <strong className="text-lg">#{order.orderNumber}</strong>
          </div>
          <p className="mt-2 text-sm text-[#a6b0a8]">
            {dateTime.format(new Date(order.placedAt))}
          </p>
          <p className="mt-3 flex items-center gap-2 font-bold">
            {order.fulfillmentType === "delivery" ? (
              <Bike size={17} className="text-[#73d5c1]" />
            ) : (
              <ShoppingBag size={17} className="text-[#a8e91d]" />
            )}
            {order.storeName} ·{" "}
            <span className="capitalize">{order.fulfillmentType}</span>
          </p>
          <div className="mt-3 flex gap-2">
            {order.items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="relative size-14 overflow-hidden border border-[#344039] bg-[#111812]"
              >
                {item.imageUrl ? (
                    <CustomerImage
                      src={item.imageUrl}
                      alt=""
                      sizes="56px"
                      className="object-contain p-1"
                    />
                ) : (
                  <ShoppingBag className="size-full p-4 text-[#6b786e]" />
                )}
              </div>
            ))}
            {order.items.length > 3 ? (
              <span className="grid size-14 place-items-center border border-[#344039] bg-[#111812] text-sm">
                +{order.items.length - 3}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-5 border-t border-[#263229] pt-4 sm:block sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <div>
            <p className="text-xs text-[#98a49b]">Total</p>
            <p className="mt-1 text-xl font-black text-[#a8e91d]">
              {money.format(order.total)}
            </p>
            <p className="mt-1 text-xs capitalize text-[#a5afa7]">
              {order.paymentStatus.replaceAll("_", " ")}
            </p>
          </div>
          <ChevronRight className="sm:mt-5" />
        </div>
      </Link>
    </article>
  );
}
