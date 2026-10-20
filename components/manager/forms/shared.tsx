import type { InputHTMLAttributes, ReactNode, WheelEvent } from "react";
import { LoaderCircle } from "lucide-react";
import type { ManagerActionState } from "@/app/dashboard/manager/actions";
import { stockDisplaySuffixForCategory } from "@/lib/manager/options";
import type { ProductCategory } from "@/lib/manager/options";

export type ManagerFormAction = (prev: ManagerActionState, formData: FormData) => Promise<ManagerActionState>;

export const initialState: ManagerActionState = { ok: false, message: "" };

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-bold text-white/90">{label}<span className="mt-2 block">{children}</span></label>;
}

export function Message({ state }: { state: ManagerActionState }) {
  if (!state.message) return null;
  return <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${state.ok ? "border-lime-300/35 bg-lime-400/10 text-lime-200" : "border-red-300/35 bg-red-500/10 text-red-100"}`}>{state.message}</p>;
}

export function PendingSpinner({ className = "" }: { className?: string }) {
  return <LoaderCircle aria-hidden="true" className={`animate-spin ${className}`} size={16} />;
}

export function PendingNotice({ active, text }: { active: boolean; text: string }) {
  if (!active) return null;
  return (
    <p role="status" aria-live="polite" className="rounded-xl border border-lime-300/30 bg-lime-400/10 px-4 py-3 text-sm font-semibold text-lime-100">
      <PendingSpinner className="mr-2 inline align-[-2px]" />
      {text}
    </p>
  );
}

export function formatStockQuantity(quantity: number | null | undefined, category: ProductCategory | "" | null | undefined) {
  if (quantity === null || quantity === undefined || !Number.isFinite(Number(quantity))) return "--";
  const normalized = Number(quantity);
  const suffix = stockDisplaySuffixForCategory(category);
  return suffix === "g" ? `${normalized}g` : `${normalized} ${suffix}`;
}

type ManualNumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> & {
  mode: "integer" | "decimal";
};

export function ManualNumberInput({ mode, pattern, onWheel, ...props }: ManualNumberInputProps) {
  const inputMode = mode === "decimal" ? "decimal" : "numeric";
  const defaultPattern = mode === "decimal" ? "[0-9]+(\\.[0-9]{1,2})?" : "[0-9]*";

  function handleWheel(event: WheelEvent<HTMLInputElement>) {
    event.currentTarget.blur();
    onWheel?.(event);
  }

  return <input {...props} type="text" inputMode={inputMode} pattern={pattern ?? defaultPattern} onWheel={handleWheel} />;
}
