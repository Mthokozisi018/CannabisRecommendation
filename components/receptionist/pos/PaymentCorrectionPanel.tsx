"use client";

import { useEffect, useRef } from "react";
import { Banknote, Check, CreditCard, Split } from "lucide-react";
import { paymentError, type POSPayment } from "@/lib/pos-payment";
import { formatPOSMoney as money } from "@/lib/pos-receipt";

const methods = [
  { method: "card", label: "Card", action: "Change to Card", Icon: CreditCard },
  { method: "cash", label: "Cash", action: "Change to Cash", Icon: Banknote },
  { method: "split", label: "Split Payment", action: "Split Payment", Icon: Split }
] as const;
const methodLabel = (method: POSPayment["method"]) => methods.find((option) => option.method === method)?.label;

type Props = {
  originalMethod: POSPayment["method"];
  currentPayment: POSPayment;
  payment: POSPayment;
  total: number;
  reason: string;
  confirmed: boolean;
  pending: boolean;
  error: string;
  onPayment: (payment: POSPayment) => void;
  onReason: (reason: string) => void;
  onCancel: () => void;
  onReview: () => void;
  onSave: () => void;
};

export function PaymentCorrectionPanel({ originalMethod, currentPayment, payment, total, reason, confirmed, pending, error, onPayment, onReason, onCancel, onReview, onSave }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [confirmed]);
  const invalid = paymentError(payment, total);
  const unchanged = payment.method === currentPayment.method && payment.cashAmount === currentPayment.cashAmount && payment.cardAmount === currentPayment.cardAmount;

  function selectMethod(method: POSPayment["method"]) {
    onPayment({ method, cashAmount: method === "card" ? 0 : total, cardAmount: method === "card" ? total : 0 });
  }

  return <form className="gc-payment-correction" onSubmit={(event) => {
    event.preventDefault();
    if (pending || invalid || unchanged || reason.trim().length < 5) return;
    if (confirmed) onSave(); else onReview();
  }}>
    <h2 ref={heading} tabIndex={-1} id="payment-correction-title">{confirmed ? "Confirm Payment Change" : "Change Payment Method"}</h2>
    {error && <p role="alert" className="gc-payment-error">{error}</p>}
    <p className="gc-payment-original">Original Payment Method: <strong>{methodLabel(originalMethod)}</strong></p>
    {confirmed ? <div className="gc-payment-review" role="status">
      <p>New Payment Method: <strong>{methodLabel(payment.method)}</strong></p>
      {payment.method === "split" && <p>Cash: <strong>{money(payment.cashAmount)}</strong> · Card: <strong>{money(payment.cardAmount)}</strong></p>}
      <p><span>Reason for Change</span><strong className="gc-payment-review-reason">{reason.trim()}</strong></p>
    </div> : <>
      <fieldset disabled={pending}>
        <legend>Select New Payment Method</legend>
        <div className="gc-payment-options">
          {methods.map(({ method, label, action, Icon }) => <button key={method} type="button" aria-label={action} aria-pressed={payment.method === method} onClick={() => selectMethod(method)}>
            <Icon aria-hidden="true" />
            <strong>{label}</strong>
            <span>{action}</span>
            {payment.method === method && <Check className="gc-payment-selected" size={14} aria-hidden="true" />}
          </button>)}
        </div>
      </fieldset>
      {payment.method === "split" && <div className="gc-payment-amounts">
        {(["cashAmount", "cardAmount"] as const).map((key) => <label key={key}>{key === "cashAmount" ? "Cash Amount" : "Card Amount"}
          <input type="number" inputMode="decimal" min="0" max={total} step="0.01" required disabled={pending} value={payment[key]} onChange={(event) => onPayment({ ...payment, [key]: Number(event.target.value) })} />
        </label>)}
      </div>}
      {invalid && <p role="alert" className="gc-payment-validation">{invalid}</p>}
      <label className="gc-payment-reason">Reason for Change
        <textarea rows={3} required minLength={5} maxLength={1000} disabled={pending} value={reason} placeholder="Enter the reason for changing the payment method..." onChange={(event) => onReason(event.target.value)} />
      </label>
    </>}
    <div className="gc-payment-footer">
      <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
      <button type="submit" disabled={pending || reason.trim().length < 5 || Boolean(invalid) || unchanged}>{pending ? "Saving…" : confirmed ? "Confirm and Save" : "Confirm Change"}</button>
    </div>
  </form>;
}
