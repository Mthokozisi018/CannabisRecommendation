import Link from "next/link";
import { Check, Clock3, MapPin, Navigation } from "lucide-react";
import { notFound } from "next/navigation";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { getCustomerOrder } from "@/lib/customer/orders";

function formatCollectionDeadline(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(value));
}

export default async function CustomerOrderConfirmedPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getCustomerOrder(orderId);
  if (!order) notFound();
  return (
    <main className="min-h-screen">
      <CustomerHeader />
      <section className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6">
        <span className="mx-auto grid size-20 place-items-center rounded-full border border-[#a8e91d] bg-[#142208] text-[#a8e91d]">
          <Check size={40} />
        </span>
        <p className="mt-6 text-sm font-bold text-[#a8e91d]">Order confirmed</p>
        <h1 className="mt-2 text-3xl font-black">Thank you for your order</h1>
        <p className="mt-3 text-[#aab4ac]">
          #{order.orderNumber} has been sent to {order.storeName}.
        </p>
        <div className="mt-7 border border-[#2e3a32] bg-[#08100b] p-5 text-left">
          <h2 className="font-black capitalize">
            {order.fulfillmentType} details
          </h2>
          <p className="mt-4 flex items-start gap-2 text-sm text-[#b2bbb4]">
            <MapPin size={17} className="mt-0.5 shrink-0 text-[#a8e91d]" />
            {order.fulfillmentType === "delivery"
              ? [
                  order.fulfillment?.addressLine,
                  order.fulfillment?.suburb,
                  order.fulfillment?.city,
                  order.fulfillment?.province,
                  order.fulfillment?.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")
              : order.fulfillment?.storeAddress || order.storeName}
          </p>
          {order.fulfillmentType === "collection" &&
          order.collectionExpiresAt ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#2d3931] pt-4">
              <p className="flex items-start gap-2 text-sm text-[#e8c071]">
                <Clock3 size={17} className="mt-0.5 shrink-0" />
                Collect by {formatCollectionDeadline(order.collectionExpiresAt)}
              </p>
              {order.fulfillment?.storeAddress ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.fulfillment.storeAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 border border-[#425046] px-3 text-sm font-bold text-[#eef4ef]"
                >
                  <Navigation size={16} aria-hidden="true" />
                  Directions
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/customer/orders/${order.id}` as never}
            className="flex h-12 items-center justify-center border border-[#a7e627] bg-[#a7e627] font-black text-[#081000]"
          >
            Track order
          </Link>
          <Link
            href="/customer/shop"
            className="flex h-12 items-center justify-center border border-[#425046] bg-[#08100b] font-bold"
          >
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}
