import {
  Bike,
  Check,
  Clock3,
  MapPin,
  PackageCheck,
  Phone,
  ShoppingBag,
} from "lucide-react";
import { notFound } from "next/navigation";
import { CustomerCancelOrderButton } from "@/components/customer/CustomerCancelOrderButton";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CustomerImage } from "@/components/customer/CustomerImage";
import { orderStatusLabel } from "@/components/customer/CustomerOrderCard";
import { getCustomerOrder } from "@/lib/customer/orders";

const money = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});
const dateTime = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Johannesburg",
});

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getCustomerOrder(orderId);
  if (!order) notFound();
  const delivery = order.fulfillmentType === "delivery";
  const steps = delivery
    ? [
        { label: "Order placed", complete: true, time: order.placedAt },
        {
          label: "Preparing",
          complete: Boolean(
            order.preparingAt ||
              [
                "preparing",
                "out_for_delivery",
                "delivered",
                "completed",
              ].includes(order.status),
          ),
          time: order.preparingAt,
        },
        {
          label: "Delivery confirmed",
          complete: order.deliveryTracking.some(
            (event) => event.status === "delivery_confirmed",
          ),
          time:
            order.deliveryTracking.find(
              (event) => event.status === "delivery_confirmed",
            )?.occurredAt ?? null,
        },
        {
          label: "Out for delivery",
          complete: Boolean(
            order.outForDeliveryAt ||
              ["out_for_delivery", "delivered"].includes(order.status),
          ),
          time: order.outForDeliveryAt,
        },
        {
          label: "Delivered",
          complete: Boolean(order.deliveredAt || order.status === "delivered"),
          time: order.deliveredAt,
        },
      ]
    : [
        { label: "Order placed", complete: true, time: order.placedAt },
        {
          label: "Preparing",
          complete: Boolean(
            order.preparingAt ||
              [
                "preparing",
                "ready_for_collection",
                "collected",
                "completed",
              ].includes(order.status),
          ),
          time: order.preparingAt,
        },
        {
          label: "Ready for collection",
          complete: Boolean(
            order.readyAt ||
              ["ready_for_collection", "collected", "completed"].includes(
                order.status,
              ),
          ),
          time: order.readyAt,
        },
        {
          label: "Collected",
          complete: Boolean(
            order.collectedAt ||
              ["collected", "completed"].includes(order.status),
          ),
          time: order.collectedAt ?? order.completedAt,
        },
        {
          label: "Completed",
          complete: ["collected", "completed"].includes(order.status),
          time: order.completedAt ?? order.collectedAt,
        },
      ];
  const latestTracking = order.deliveryTracking.at(-1);
  const canCancel = ["pending", "placed"].includes(order.status);

  return (
    <main className="min-h-screen">
      <CustomerHeader
        backHref="/customer/orders?view=track"
        backLabel="Back to orders"
      />
      <section className="border-y border-[#253029] bg-[#08110b]">
        <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="border border-[#587722] bg-[#142208] px-3 py-1 text-sm font-bold text-[#b2ea3e]">
              {orderStatusLabel(order.status)}
            </span>
            <h1 className="text-2xl font-black sm:text-3xl">
              #{order.orderNumber}
            </h1>
          </div>
          <p className="mt-2 text-sm text-[#a7b1a9]">
            Placed {dateTime.format(new Date(order.placedAt))} ·{" "}
            {order.storeName}
          </p>
        </div>
      </section>
      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
        <div className="grid gap-5">
          <section className="border border-[#2d3931] bg-[#08100b] p-5">
            <h2 className="flex items-center gap-2 text-xl font-black">
              {delivery ? (
                <Bike className="text-[#72d5c0]" />
              ) : (
                <ShoppingBag className="text-[#a8e91d]" />
              )}
              Track {delivery ? "delivery" : "collection"}
            </h2>
            <ol className="mt-6">
              {steps.map((step, index) => (
                <li
                  key={step.label}
                  className="grid grid-cols-[2.5rem_1fr] gap-3"
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid size-8 place-items-center rounded-full border ${step.complete ? "border-[#a8e91d] bg-[#a8e91d] text-[#081000]" : "border-[#4a574e] bg-[#111813] text-[#7f8b82]"}`}
                    >
                      {step.complete ? (
                        <Check size={17} />
                      ) : (
                        <Clock3 size={15} />
                      )}
                    </span>
                    {index < steps.length - 1 ? (
                      <span
                        className={`h-12 w-px ${step.complete ? "bg-[#708e2b]" : "bg-[#344038]"}`}
                      />
                    ) : null}
                  </div>
                  <div className="pt-1">
                    <p
                      className={`font-bold ${step.complete ? "text-white" : "text-[#7f8b82]"}`}
                    >
                      {step.label}
                    </p>
                    {step.time ? (
                      <p className="mt-1 text-xs text-[#99a49b]">
                        {dateTime.format(new Date(step.time))}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
            {!delivery &&
            order.collectionExpiresAt &&
            !["completed", "collected", "cancelled", "forfeited"].includes(
              order.status,
            ) ? (
              <p className="mt-5 border border-[#735126] bg-[#231a0c] p-3 text-sm text-[#efc576]">
                Collection reservation expires{" "}
                {dateTime.format(new Date(order.collectionExpiresAt))}.
              </p>
            ) : null}
          </section>
          {delivery && latestTracking ? (
            <section className="border border-[#2d3931] bg-[#08100b] p-5">
              <h2 className="text-lg font-black">Delivery update</h2>
              <p className="mt-2 capitalize text-[#b7c0b9]">
                {latestTracking.status.replaceAll("_", " ")}
              </p>
              {latestTracking.driverName ? (
                <p className="mt-3 font-bold">
                  Driver: {latestTracking.driverName}
                </p>
              ) : null}
              {latestTracking.driverPhone ? (
                <a
                  href={`tel:${latestTracking.driverPhone}`}
                  className="mt-2 inline-flex items-center gap-2 text-[#a8e91d]"
                >
                  <Phone size={16} />
                  {latestTracking.driverPhone}
                </a>
              ) : null}
              {latestTracking.latitude !== null &&
              latestTracking.longitude !== null ? (
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${latestTracking.latitude},${latestTracking.longitude}`}
                  className="mt-3 flex items-center gap-2 text-sm text-[#a8e91d]"
                >
                  <MapPin size={16} />
                  View latest recorded location
                </a>
              ) : null}
            </section>
          ) : null}
          {canCancel ? <CustomerCancelOrderButton orderId={order.id} /> : null}
        </div>

        <aside className="grid h-fit gap-5">
          <section className="border border-[#2d3931] bg-[#08100b] p-5">
            <h2 className="text-lg font-black">Fulfillment details</h2>
            <p className="mt-4 flex items-start gap-2 text-sm">
              <MapPin size={17} className="mt-0.5 shrink-0 text-[#a8e91d]" />
              {delivery
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
            {order.fulfillment?.recipientName ? (
              <p className="mt-3 text-sm text-[#aab4ac]">
                For {order.fulfillment.recipientName} ·{" "}
                {order.fulfillment.recipientPhone}
              </p>
            ) : null}
            {order.storePhone ? (
              <a
                href={`tel:${order.storePhone}`}
                className="mt-4 inline-flex h-10 items-center gap-2 border border-[#597521] px-4 font-bold text-[#a8e91d]"
              >
                <Phone size={17} />
                Contact store
              </a>
            ) : null}
          </section>
          <section className="border border-[#2d3931] bg-[#08100b] p-5">
            <h2 className="text-lg font-black">Order summary</h2>
            <ul className="mt-3 divide-y divide-[#263229]">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <div className="relative size-12 shrink-0 bg-[#111812]">
                    {item.imageUrl ? (
                            <CustomerImage
                              src={item.imageUrl}
                              alt=""
                              sizes="48px"
                              className="object-contain p-1"
                            />
                    ) : (
                      <PackageCheck className="size-full p-3 text-[#718076]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="mt-1 text-xs text-[#98a49b]">
                      {item.quantity} × {money.format(item.unitPrice)}
                    </p>
                  </div>
                  <strong className="text-sm">
                    {money.format(item.lineTotal)}
                  </strong>
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid gap-2 border-t border-[#344138] pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#9ba69e]">Subtotal</dt>
                <dd>{money.format(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#9ba69e]">Fulfillment fee</dt>
                <dd>{money.format(order.fulfillmentFee)}</dd>
              </div>
              <div className="flex justify-between pt-2 text-lg font-black">
                <dt>Total</dt>
                <dd className="text-[#a8e91d]">{money.format(order.total)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
