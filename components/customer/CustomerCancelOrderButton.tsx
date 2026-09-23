"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { cancelCustomerOrderAction } from "@/app/customer/actions";

export function CustomerCancelOrderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function cancel() {
    if (!window.confirm("Cancel this order and release its reserved items?")) return;
    startTransition(async () => { const result = await cancelCustomerOrderAction({ orderId }); setMessage(result.message); if (result.ok) window.location.reload(); });
  }
  return <div><button disabled={pending} onClick={cancel} className="inline-flex h-11 items-center justify-center gap-2 border border-[#7b3933] bg-[#21100e] px-4 font-bold text-[#ff9189] disabled:opacity-50"><X size={18} />{pending ? "Cancelling..." : "Cancel order"}</button>{message ? <p className="mt-2 text-sm text-[#d8aaa6]">{message}</p> : null}</div>;
}
