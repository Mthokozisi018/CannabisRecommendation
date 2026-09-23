"use client";

import Image, { type ImageLoader } from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Package,
  Phone,
  RefreshCw,
  Search,
  Store,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import {
  confirmPendingOrderAction,
  forfeitPendingOrderAction,
} from "@/app/dashboard/manager/orders/actions";
import type { PendingOrder } from "@/lib/manager/pending-orders";

const money = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});
const date = new Intl.DateTimeFormat("en-ZA", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Johannesburg",
});
const time = new Intl.DateTimeFormat("en-ZA", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Africa/Johannesburg",
});
const imageLoader: ImageLoader = ({ src }) => src;

function paymentLabel(method: PendingOrder["paymentMethod"]) {
  return method === "cash" ? "Cash" : "Card";
}

function ConfirmDialog({
  mode,
  order,
  pending,
  message,
  onCancel,
  onConfirm,
}: {
  mode: "confirm" | "forfeit";
  order: PendingOrder;
  pending: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirming = mode === "confirm";
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#010504] p-4"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-confirm-title"
        className="w-full max-w-md rounded-lg border border-[#425047] bg-[#0d1511] p-5 text-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className={`text-xs font-black uppercase ${confirming ? "text-[#56d774]" : "text-[#ff7777]"}`}
            >
              #{order.orderNumber}
            </p>
            <h2 id="order-confirm-title" className="mt-1 text-xl font-black">
              {confirming ? "Confirm this sale?" : "Forfeit this order?"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="grid size-9 place-items-center rounded-md border border-[#526158] bg-[#18221d]"
            aria-label="Close confirmation"
          >
            <X size={19} />
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#bec8c1]">
          {confirming
            ? "Confirm that payment was received and the customer collected every item. This creates the completed sale."
            : "Reserved items will be released back into available inventory. This action cannot be undone."}
        </p>
        {message ? (
          <p
            className="mt-4 rounded-md border border-[#9a3838] bg-[#2b0c0c] px-3 py-2 text-sm font-bold text-[#ffd1d1]"
            role="alert"
          >
            {message}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-11 rounded-md border border-[#526158] bg-[#18221d] font-black disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`h-11 rounded-md border font-black disabled:opacity-50 ${confirming ? "border-[#38d361] bg-[#12672b] text-white" : "border-[#ef4e4e] bg-[#8f1f1f] text-white"}`}
          >
            {pending
              ? "Processing..."
              : confirming
                ? "Confirm Sale"
                : "Forfeit Order"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ManagerPendingOrdersUI({
  initialOrders,
  storeName,
}: {
  initialOrders: PendingOrder[];
  storeName: string;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [selectedId, setSelectedId] = useState(initialOrders[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [dialog, setDialog] = useState<"confirm" | "forfeit" | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("en-ZA");
    return orders
      .filter((order) => payment === "all" || order.paymentMethod === payment)
      .filter(
        (order) =>
          !term ||
          [
            order.customerName,
            order.customerPhone,
            order.orderNumber,
            `#${order.orderNumber}`,
          ].some((value) => value.toLocaleLowerCase("en-ZA").includes(term)),
      )
      .sort((a, b) =>
        sort === "newest"
          ? b.createdAt.localeCompare(a.createdAt)
          : a.createdAt.localeCompare(b.createdAt),
      );
  }, [orders, payment, search, sort]);
  const selected =
    orders.find((order) => order.id === selectedId) ?? visibleOrders[0] ?? null;

  function runAction() {
    if (!selected || !dialog) return;
    setActionMessage("");
    startTransition(async () => {
      const result =
        dialog === "confirm"
          ? await confirmPendingOrderAction({ orderId: selected.id })
          : await forfeitPendingOrderAction({ orderId: selected.id });
      if (!result.ok) {
        setActionMessage(result.message);
        return;
      }
      const next = orders.filter((order) => order.id !== selected.id);
      setOrders(next);
      setSelectedId(next[0]?.id ?? "");
      setDialog(null);
      router.refresh();
    });
  }

  return (
    <main className="gc-pending-orders-page min-h-screen bg-[#030706] px-4 py-5 text-white sm:px-6 lg:px-10">
      <header className="mx-auto flex w-full max-w-[1540px] flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/manager"
              className="grid size-10 place-items-center rounded-md border border-[#35423b] bg-[#101713]"
              aria-label="Back to manager dashboard"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-3xl font-black tracking-normal sm:text-4xl">
              Pending Orders
            </h1>
            <span className="rounded-md border border-[#175f32] bg-[#0b321b] px-3 py-1 text-base font-black text-[#55df78]">
              {orders.length}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#b4bdb7] sm:text-base">
            Orders placed by customers that are awaiting payment and collection.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="relative grid size-11 place-items-center rounded-md border border-[#35423b] bg-[#101713]"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {orders.length ? (
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[#27843f] px-1 text-[10px] font-black leading-5">
                {orders.length > 99 ? "99+" : orders.length}
              </span>
            ) : null}
          </button>
          <div className="flex h-12 min-w-0 items-center gap-2 rounded-md border border-[#35423b] bg-[#101713] px-4">
            <Store size={19} className="shrink-0 text-[#50d66e]" />
            <span className="max-w-52 truncate text-sm font-bold">
              {storeName}
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-6 grid w-full max-w-[1540px] gap-3 md:grid-cols-[minmax(260px,1.35fr)_minmax(180px,0.9fr)_minmax(180px,0.9fr)_48px]">
        <label className="flex h-12 items-center gap-3 rounded-md border border-[#35423b] bg-[#0d1411] px-4 focus-within:border-[#38c85b]">
          <Search size={20} className="text-[#aeb8b1]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, phone or order number..."
            className="min-w-0 flex-1 bg-[#0d1411] text-sm outline-none placeholder:text-[#8e9992]"
          />
        </label>
        <label className="relative">
          <span className="sr-only">Payment method</span>
          <select
            value={payment}
            onChange={(event) => setPayment(event.target.value)}
            className="h-12 w-full appearance-none rounded-md border border-[#35423b] bg-[#0d1411] px-4 pr-10 text-sm font-bold outline-none"
          >
            <option value="all">All Payment Methods</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-3.5"
            size={18}
          />
        </label>
        <label className="relative">
          <span className="sr-only">Sort pending orders</span>
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as "newest" | "oldest")
            }
            className="h-12 w-full appearance-none rounded-md border border-[#35423b] bg-[#0d1411] px-4 pr-10 text-sm font-bold outline-none"
          >
            <option value="newest">Sort by: Newest</option>
            <option value="oldest">Sort by: Oldest</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-3.5"
            size={18}
          />
        </label>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="grid size-12 place-items-center rounded-md border border-[#35423b] bg-[#0d1411]"
          aria-label="Refresh pending orders"
          title="Refresh orders"
        >
          <RefreshCw size={20} />
        </button>
      </section>

      <section className="gc-pending-orders-layout mx-auto mt-5 grid w-full max-w-[1540px] items-start gap-4 lg:grid-cols-[minmax(310px,31%)_minmax(0,69%)]">
        <div className="scrollbar-thin grid max-h-[calc(100vh-220px)] gap-2.5 overflow-y-auto pr-1">
          {visibleOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => setSelectedId(order.id)}
              className={`w-full rounded-md border p-4 text-left ${selected?.id === order.id ? "border-[#2fc85a] bg-[#0c1c13]" : "border-[#303b35] bg-[#0b110e] hover:border-[#526158]"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-lg">#{order.orderNumber}</strong>
                <span className="rounded-md border border-[#735e12] bg-[#332807] px-2.5 py-1 text-[11px] font-black text-[#ffd12f]">
                  PENDING
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="font-bold">{order.customerName}</span>
                <span className="flex items-center gap-2 text-sm text-[#c3cbc6]">
                  <Phone size={15} />
                  {order.customerPhone}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-2 text-sm text-[#aeb8b1]">
                <span className="flex items-center gap-2">
                  <Package size={15} />
                  {order.distinctProductCount} product
                  {order.distinctProductCount === 1 ? "" : "s"}
                </span>
                <strong className="row-span-2 text-xl text-[#45d766]">
                  {money.format(order.total)}
                </strong>
                <span className="flex items-center gap-2">
                  <CalendarDays size={15} />
                  {date.format(new Date(order.createdAt))} ·{" "}
                  {time.format(new Date(order.createdAt))}
                </span>
              </div>
            </button>
          ))}
          {visibleOrders.length === 0 ? (
            <div className="rounded-md border border-[#303b35] bg-[#0b110e] p-10 text-center">
              <Package className="mx-auto text-[#4bd26a]" size={42} />
              <h2 className="mt-3 text-xl font-black">No pending orders</h2>
              <p className="mt-2 text-sm text-[#aeb8b1]">
                New customer collection orders will appear here.
              </p>
            </div>
          ) : null}
        </div>

        {selected ? (
          <article className="rounded-md border border-[#303b35] bg-[#0a100d] p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black sm:text-3xl">
                #{selected.orderNumber}
              </h2>
              <span className="rounded-md border border-[#735e12] bg-[#332807] px-2.5 py-1 text-xs font-black text-[#ffd12f]">
                PENDING
              </span>
            </div>
            {selected.collectionExpiresAt ? (
              <p className={`mt-4 rounded-md border px-3 py-2 text-sm font-bold ${selected.forfeitEligible ? "border-[#8a3434] bg-[#2c1010] text-[#ff9b9b]" : "border-[#725b1f] bg-[#251d08] text-[#f1d16f]"}`}>
                {selected.forfeitEligible
                  ? "Eligible for forfeiture: the four-day collection window has expired."
                  : `Reserved until ${date.format(new Date(selected.collectionExpiresAt))} · ${time.format(new Date(selected.collectionExpiresAt))}`}
              </p>
            ) : null}
            <section className="mt-6 grid gap-5 border-b border-[#303b35] pb-5 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-bold text-[#9da7a0]">Customer</p>
                <p className="mt-2 font-black">{selected.customerName}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-[#c2cbc5]">
                  <Phone size={15} className="text-[#4bd26a]" />
                  {selected.customerPhone}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#9da7a0]">Order Date</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-bold">
                  <CalendarDays size={17} className="text-[#4bd26a]" />
                  {date.format(new Date(selected.createdAt))} ·{" "}
                  {time.format(new Date(selected.createdAt))}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#9da7a0]">
                  Payment Method
                </p>
                <p className="mt-2 flex items-center gap-2 font-bold">
                  {selected.paymentMethod === "cash" ? (
                    <WalletCards size={18} className="text-[#4bd26a]" />
                  ) : (
                    <CreditCard size={18} className="text-[#4bd26a]" />
                  )}
                  {paymentLabel(selected.paymentMethod)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#9da7a0]">
                  Payment Status
                </p>
                <span className="mt-2 inline-flex rounded-md border border-[#3b4d92] bg-[#202a60] px-3 py-1.5 text-xs font-black text-[#b9c5ff]">
                  AWAITING PAYMENT
                </span>
              </div>
            </section>
            <h3 className="mt-5 text-lg font-black">Order Items</h3>
            <div className="mt-3 overflow-x-auto rounded-md border border-[#303b35] bg-[#080d0b]">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#303b35] bg-[#111915] text-left text-xs text-[#bbc4be]">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-center">Quantity</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[#27302b] last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3">
                          <span className="relative size-12 shrink-0 overflow-hidden rounded-md border border-[#3b4740] bg-[#172019]">
                            <Image
                              loader={imageLoader}
                              unoptimized
                              src={item.imageUrl}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-contain p-1"
                            />
                          </span>
                          <span className="font-bold">{item.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        {money.format(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {money.format(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#303b35]">
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-right text-[#b4beb8]"
                    >
                      Subtotal
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money.format(selected.subtotal)}
                    </td>
                  </tr>
                  <tr className="bg-[#0c2414]">
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-right text-lg font-black text-[#4bd26a]"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-xl font-black text-[#4bd26a]">
                      {money.format(selected.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!selected.forfeitEligible}
                onClick={() => {
                  setActionMessage("");
                  setDialog("forfeit");
                }}
                className="flex min-h-16 items-center justify-center gap-3 rounded-md border border-[#e04444] bg-[#781919] px-4 text-white disabled:cursor-not-allowed disabled:border-[#4c5550] disabled:bg-[#232a26] disabled:text-[#8d9891]"
              >
                <XCircle size={24} />
                <span>
                  <strong className="block text-lg">Forfeit Order</strong>
                  <span className="block text-xs text-[#ffd0d0]">
                    {selected.forfeitEligible ? "Release items back to inventory" : "Available after four days"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionMessage("");
                  setDialog("confirm");
                }}
                className="flex min-h-16 items-center justify-center gap-3 rounded-md border border-[#3adb61] bg-[#126429] px-4 text-white"
              >
                <CheckCircle2 size={24} />
                <span>
                  <strong className="block text-lg">Confirm Sale</strong>
                  <span className="block text-xs text-[#d9ffe2]">
                    Payment received and items collected
                  </span>
                </span>
              </button>
            </div>
          </article>
        ) : (
          <div className="rounded-md border border-[#303b35] bg-[#0a100d] p-10 text-center text-[#aeb8b1]">
            Select a pending order to view its details.
          </div>
        )}
      </section>
      {dialog && selected ? (
        <ConfirmDialog
          mode={dialog}
          order={selected}
          pending={pending}
          message={actionMessage}
          onCancel={() => !pending && setDialog(null)}
          onConfirm={runAction}
        />
      ) : null}
    </main>
  );
}
