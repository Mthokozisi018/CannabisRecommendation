import type { POSPayment } from "@/lib/pos-payment";

export type POSReceipt = {
  id: string; checkout_id: string; created_at: string; subtotal: number; total: number;
  payment_method: POSPayment["method"] | null; cash_amount: number | null; card_amount: number | null;
  refunded_amount: number; version: number; payment_provider: string | null;
  customer: { full_name: string; phone_display: string } | null;
  items: { id: string; product_name_snapshot: string; category_snapshot: string | null; strain_snapshot: string | null; cultivation_snapshot: string | null; image_snapshot: string | null; quantity: number; unit_price: number; line_total: number }[];
  events: { id: string; kind: string; reason: string; actor_name: string; created_at: string; before_payment: POSPayment; after_payment: POSPayment; amount: number }[];
};
export const formatPOSMoney = (amount: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);
