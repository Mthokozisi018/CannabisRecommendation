"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, CreditCard, History, Loader2, ReceiptText, RotateCcw, ShoppingCart, UserRound, X } from "lucide-react";
import { amendPOSTransactionAction, getPOSReceiptAction, searchPOSTransactionsAction } from "@/app/dashboard/receptionist/transactions";
import { formatPOSMoney as money, type POSReceipt } from "@/lib/pos-receipt";
import { PaymentCorrectionPanel } from "@/components/receptionist/pos/PaymentCorrectionPanel";
import { paymentError, type POSPayment } from "@/lib/pos-payment";

const dateTime = (date: string) => new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const paymentFor = (sale: POSReceipt): POSPayment => ({ method: sale.payment_method ?? "cash", cashAmount: Number(sale.cash_amount ?? 0), cardAmount: Number(sale.card_amount ?? 0) });
const field = "mt-1 w-full rounded-lg border border-emerald-700 bg-[#061b14] p-3 text-white";

function ReceiptProductImage({ src }: { src: string | null }) {
  if (!src) return <span className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-900"><ShoppingCart size={20} /></span>;
  // Historical snapshot URLs can come from multiple store storage hosts.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" className="size-10 shrink-0 rounded-md object-cover" />;
}

export function TransactionWorkspace({ saleId, onClose, onUpdated }: { saleId?: string; onClose: () => void; onUpdated?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sale, setSale] = useState<POSReceipt | null>(null);
  const [selectedId, setSelectedId] = useState(saleId);
  const [history, setHistory] = useState(!saleId);
  const [historyResult, setHistoryResult] = useState<{ key: string; rows: POSReceipt[]; error?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<"payment_correction" | "refund" | null>(null);
  const [payment, setPayment] = useState<POSPayment>({ method: "cash", cashAmount: 0, cardAmount: 0 });
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [returned, setReturned] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [retry, setRetry] = useState(0);
  const historyKey = JSON.stringify([search, date, page, retry]);
  const historyLoading = history && historyResult?.key !== historyKey;
  const rows = historyResult?.key === historyKey ? historyResult.rows : [];
  const historyError = historyResult?.key === historyKey ? historyResult.error : undefined;

  useEffect(() => {
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal();
    return () => { node?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => {
    if (!selectedId || history) return;
    let active = true;
    start(async () => {
      try {
        const result = await getPOSReceiptAction(selectedId);
        if (!active) return;
        if (result.ok) { setSale(result.receipt); setError(""); }
        else setError(result.message);
      } catch { if (active) setError("Receipt request was interrupted. Reload to try again."); }
    });
    return () => { active = false; };
  }, [selectedId, retry, history]);
  useEffect(() => {
    if (!history) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await searchPOSTransactionsAction({ search, date, page });
        if (!active) return;
        setHistoryResult(result.ok ? { key: historyKey, rows: result.receipts } : { key: historyKey, rows: [], error: result.message });
      } catch {
        if (active) setHistoryResult({ key: historyKey, rows: [], error: "History request was interrupted. Please retry." });
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [history, search, date, page, retry, historyKey]);

  function begin(kind: "payment_correction" | "refund") {
    if (!sale) return;
    setEditing(kind); setPayment(paymentFor(sale)); setReason(""); setConfirmed(false); setReturned(false); setError(""); setRequestId(crypto.randomUUID());
  }
  function save() {
    if (!sale || !editing || !confirmed || pending) return;
    start(async () => {
      try {
        const result = await amendPOSTransactionAction({ saleId: sale.id, requestId, version: sale.version, kind: editing, reason, payment, returnedExternally: returned });
        if (result.ok) {
          setSale(result.receipt); setEditing(null); setError(""); onUpdated?.();
          if (editing === "payment_correction") requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>("[data-payment-correction-trigger]")?.focus());
        }
        else { setError(result.message); setConfirmed(false); }
      } catch { setError("Update could not be confirmed. Reload the receipt before retrying."); }
    });
  }
  const invalid = sale ? paymentError(payment, Number(sale.total)) : null;
  const blocked = Boolean(sale?.payment_provider || Number(sale?.refunded_amount) > 0 || !sale?.payment_method);
  const correctingPayment = editing === "payment_correction" && Boolean(sale);
  function cancelCorrection() {
    setEditing(null); setError("");
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>("[data-payment-correction-trigger]")?.focus());
  }
  return <dialog ref={dialog} aria-labelledby={correctingPayment ? "payment-correction-title" : "pos-transaction-title"} onCancel={(event) => { event.preventDefault(); if (!pending) { if (correctingPayment) cancelCorrection(); else onClose(); } }} className={`gc-sale-dialog${correctingPayment ? " gc-payment-dialog" : history ? " gc-history-dialog" : ""}`}>
    <div className="gc-sale-content" aria-busy={pending && !history}>
      {correctingPayment && sale ? <PaymentCorrectionPanel
        originalMethod={sale.events.find((event) => event.kind === "payment_correction")?.before_payment.method ?? sale.payment_method!}
        currentPayment={paymentFor(sale)} payment={payment} total={Number(sale.total)} reason={reason}
        confirmed={confirmed} pending={pending} error={error} onPayment={setPayment} onReason={setReason}
        onCancel={cancelCorrection} onReview={() => setConfirmed(true)} onSave={save}
      /> : <>
      <button type="button" onClick={onClose} disabled={pending} className="absolute right-3 top-3 rounded-lg p-2 hover:bg-white/10 disabled:opacity-40" aria-label="Close transaction details"><X /></button>
      {error && !history && <div role="alert" className="mb-4 mr-10 rounded-lg border border-red-400 bg-red-950 p-3">{error} <button className="underline" onClick={() => setRetry((value) => value + 1)}>Reload</button></div>}
      {pending && !history && <p role="status" className="mb-3 text-emerald-200">Loading transaction…</p>}
      {history ? <>
        <h2 id="pos-transaction-title" className="mb-5 text-2xl font-bold">Previous Transactions</h2>
        <form onSubmit={(event) => event.preventDefault()} className="mb-5 grid gap-3 sm:grid-cols-2">
          <label>Search customer, phone or reference<input className={field} value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); setRetry((value) => value + 1); }} maxLength={100} /></label>
          <label>Transaction date<input type="date" className={field} value={date} onChange={(event) => { setDate(event.target.value); setPage(0); setRetry((value) => value + 1); }} /></label>
        </form>
        <section aria-label="Transaction results" aria-busy={historyLoading}>
        {historyLoading ? <div role="status" aria-label="Loading transactions" className="flex min-h-24 items-center justify-center py-6">
          <Loader2 size={22} className="animate-spin text-[#88f4c7] motion-reduce:animate-none" aria-hidden="true" />
          <span className="sr-only">Loading transactions...</span>
        </div> : historyError ? <div role="alert" className="rounded-lg border border-red-400/50 bg-red-950/50 p-4 text-sm">
          {historyError} <button type="button" className="ml-2 font-bold text-emerald-200 underline" onClick={() => setRetry((value) => value + 1)}>Retry</button>
        </div> : <>
        <div className="grid gap-2">{rows.map((row) => <button key={row.id} disabled={pending} onClick={() => { setSale(row); setSelectedId(row.id); setHistory(false); setError(""); }} className="grid gap-2 rounded-xl border border-emerald-800 p-4 text-left sm:grid-cols-[1fr_1fr_auto] hover:bg-emerald-900/40"><span className="min-w-0"><span className="font-bold">{dateTime(row.created_at)}</span></span><span>{row.customer?.full_name ?? "Customer unavailable"}<br />{row.customer?.phone_display}</span><strong>{money(Number(row.total))}{Number(row.refunded_amount) > 0 && <span className="block text-red-300">Refunded {money(Number(row.refunded_amount))}</span>}</strong></button>)}</div>
        {!rows.length && <p>No transactions found.</p>}
        </>}
        </section>
        <div className="mt-5 flex justify-between"><button disabled={historyLoading || Boolean(historyError) || page === 0} onClick={() => { setPage(page - 1); setRetry((value) => value + 1); }} className="rounded-lg border p-3 disabled:opacity-40">Previous</button><button disabled={historyLoading || Boolean(historyError) || rows.length < 20} onClick={() => { setPage(page + 1); setRetry((value) => value + 1); }} className="rounded-lg border p-3 disabled:opacity-40">Next</button></div>
      </> : sale ? <>
        <header className="gc-sale-heading">
          <span className="gc-sale-check"><Check aria-hidden="true" /></span>
          <h2 id="pos-transaction-title">{saleId && !Number(sale.refunded_amount) ? <>Sale Completed <span>Successfully</span></> : "Transaction Details"}</h2>
          <p>{Number(sale.refunded_amount) > 0 ? `Refund recorded: ${money(Number(sale.refunded_amount))}. Original sale preserved.` : "The transaction has been recorded and the inventory has been updated."}</p>
        </header>
        <div className="gc-sale-cards">
          <section><UserRound aria-hidden="true" /><div><span>Customer</span><strong>{sale.customer?.full_name ?? "Customer unavailable"}</strong><p>{sale.customer?.phone_display ?? "No phone recorded"}</p></div></section>
          <section><ReceiptText aria-hidden="true" /><div><span>Transaction Reference</span><strong className="break-all">{sale.checkout_id}</strong><p>{dateTime(sale.created_at)}</p></div></section>
          <section><CreditCard aria-hidden="true" /><div><span>Payment Method</span><strong className="capitalize">{sale.payment_method ?? "Not recorded"}</strong><p>{money(Number(sale.total))}</p></div><span className="gc-sale-paid">{Number(sale.refunded_amount) > 0 ? "Refunded" : sale.payment_method ? "✓ Paid" : "Not recorded"}</span></section>
        </div>
        <section className="gc-sale-products"><h3><ShoppingCart aria-hidden="true" />Products Purchased</h3>
          <div className="gc-sale-table-scroll"><table><thead><tr>{["Product Name", "Category", "Strain", "Cultivation", "Quantity", "Unit Price", "Total Price"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{sale.items.map((item) => <tr key={item.id}><td><div className="flex min-w-0 items-center gap-3"><ReceiptProductImage src={item.image_snapshot} /><strong className="break-words">{item.product_name_snapshot}</strong></div></td><td>{item.category_snapshot ?? "—"}</td><td>{item.strain_snapshot ?? "—"}</td><td>{item.cultivation_snapshot ?? "—"}</td><td>{item.quantity}</td><td>{money(Number(item.unit_price))}</td><td>{money(Number(item.unit_price) * item.quantity)}</td></tr>)}</tbody></table></div>
          <div className="gc-sale-totals"><section><p><span>Subtotal</span><strong>{money(Number(sale.subtotal))}</strong></p><p><span>Discount</span><strong>{money(Math.max(0, Number(sale.subtotal) - Number(sale.total)))}</strong></p><p className="gc-sale-total"><strong>Total Paid</strong><strong>{money(Number(sale.total))}</strong></p></section><section><h4><CreditCard size={22} />Payment Details</h4><p><span>Payment Method</span><strong className="capitalize">{sale.payment_method ?? "Not recorded"}</strong></p>{sale.payment_method === "split" && <><p><span>Cash</span><strong>{money(Number(sale.cash_amount))}</strong></p><p><span>Card</span><strong>{money(Number(sale.card_amount))}</strong></p></>}<p><span>Amount Paid</span><strong>{money(Number(sale.total))}</strong></p></section></div>
        </section>
        {editing ? <section className="mt-4 rounded-xl border border-emerald-600 p-4" aria-label={editing === "refund" ? "Refund confirmation" : "Payment correction"}>
          <h3 className="text-xl font-bold">{editing === "refund" ? "Refund Transaction" : "Change Payment Method"}</h3>
          <p className="my-3">{sale.checkout_id} · {sale.customer?.full_name} · Original amount {money(Number(sale.total))} · Current payment: {sale.payment_method}</p>
          <><p>Refund amount: <strong>{money(Number(sale.total) - Number(sale.refunded_amount))}</strong>. Return the original cash/card allocations shown above. Stock is handled separately after physical return.</p><label className="my-3 flex items-start gap-2"><input type="checkbox" checked={returned} disabled={confirmed} onChange={(event) => setReturned(event.target.checked)} />I confirm the money has been returned through the original payment method, including any external terminal refund.</label> </>
          <label>Required reason<textarea className={field} minLength={5} maxLength={1000} disabled={confirmed} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          {confirmed && <p role="status" className="my-3 rounded-lg bg-amber-900/50 p-3">Confirm {editing === "refund" ? `recording a refund of ${money(Number(sale.total))}` : `${payment.method}: Cash ${money(payment.cashAmount)}, Card ${money(payment.cardAmount)}`}? Reason: {reason}</p>}
          <div className="mt-3 flex flex-wrap gap-3"><button disabled={pending} onClick={() => { setEditing(null); setError(""); }} className="rounded-lg border p-3">Cancel</button><button disabled={pending || reason.trim().length < 5 || Boolean(invalid) || (editing === "refund" && !returned)} onClick={() => confirmed ? save() : setConfirmed(true)} className="rounded-lg bg-emerald-400 p-3 font-bold text-black disabled:opacity-40">{pending ? "Saving…" : confirmed ? "Confirm and save" : "Review change"}</button></div>
        </section> : <div className="gc-sale-actions">
          <button onClick={onClose}><ShoppingCart />Continue Selling</button>
          <button data-payment-correction-trigger disabled={blocked || pending} onClick={() => begin("payment_correction")}><CreditCard />Change Payment Method</button>
          <button onClick={() => { setHistory(true); setRetry((value) => value + 1); }}><History />View Previous Transactions</button>
          <button disabled={blocked || pending} onClick={() => begin("refund")}><RotateCcw />Refund Transaction</button>
        </div>}
        {blocked && <p className="mt-3 text-sm text-amber-200">{sale.payment_provider ? "Provider-linked transaction: use provider reconciliation for payment changes and refunds." : Number(sale.refunded_amount) > 0 ? "This sale has been refunded. Further changes require manager reconciliation." : "Historical payment information requires manager reconciliation."}</p>}
        {sale.events.length > 0 && <details className="mt-4 rounded-xl border border-emerald-800 p-3"><summary className="cursor-pointer font-bold">Transaction audit history ({sale.events.length})</summary>{sale.events.map((event) => <article className="mt-3 border-t border-emerald-900 pt-3" key={event.id}><strong>{event.kind === "refund" ? `Refund ${money(Number(event.amount))}` : "Payment correction"}</strong><p>{event.actor_name} · {dateTime(event.created_at)}</p><p>{event.reason}</p><p>Original: {event.before_payment.method} · Cash {money(Number(event.before_payment.cashAmount))} · Card {money(Number(event.before_payment.cardAmount))}</p><p>Updated: {event.after_payment.method} · Cash {money(Number(event.after_payment.cashAmount))} · Card {money(Number(event.after_payment.cardAmount))}</p></article>)}</details>}
      </> : <h2 id="pos-transaction-title" className="p-8 text-center text-xl">Loading saved sale details…</h2>}
      </>}
    </div>
  </dialog>;
}

export function TransactionDetailsButton({ saleId, onUpdated }: { saleId: string; onUpdated?: () => void }) {
  const [open, setOpen] = useState(false);
  return <><button className="my-4 rounded-xl border border-emerald-500 px-4 py-3 font-bold text-emerald-200" onClick={() => setOpen(true)}>View payment, refunds and audit history</button>{open && <TransactionWorkspace saleId={saleId} onClose={() => setOpen(false)} onUpdated={onUpdated} />}</>;
}
