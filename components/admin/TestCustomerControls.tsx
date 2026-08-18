"use client";

import { useActionState } from "react";
import { RotateCcw, UserRoundCheck } from "lucide-react";
import { ensureTestCustomerAction, resetTestCustomerAction } from "@/app/dashboard/admin/test-customer/actions";
import type { TestCustomerActionState } from "@/lib/admin/test-customer";

const initialState: TestCustomerActionState = { ok: false, message: "" };

export function TestCustomerControls() {
  const [ensureState, ensureAction, ensuring] = useActionState(ensureTestCustomerAction, initialState);
  const [resetState, resetAction, resetting] = useActionState(resetTestCustomerAction, initialState);
  const state = resetState.message ? resetState : ensureState;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form action={ensureAction}>
        <button type="submit" disabled={ensuring || resetting} className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-lime-500 px-5 text-base font-extrabold text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-65">
          <UserRoundCheck size={21} />
          {ensuring ? "Preparing..." : "Ensure Test Customer"}
        </button>
      </form>
      <form action={resetAction}>
        <button type="submit" disabled={ensuring || resetting} className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg border border-lime-400/60 bg-[#07150c] px-5 text-base font-extrabold text-lime-100 transition hover:bg-lime-400/10 disabled:cursor-wait disabled:opacity-65">
          <RotateCcw size={21} />
          {resetting ? "Resetting..." : "Reset Test Customer"}
        </button>
      </form>
      {state.message ? <p className={`sm:col-span-2 rounded-lg border px-4 py-3 text-sm font-semibold ${state.ok ? "border-lime-400/70 bg-lime-500/10 text-lime-100" : "border-red-400/70 bg-red-500/10 text-red-100"}`}>{state.message}</p> : null}
    </div>
  );
}
