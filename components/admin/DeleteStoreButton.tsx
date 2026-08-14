"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteStoreAction, type AdminActionState } from "@/app/dashboard/admin/actions";

const initialState: AdminActionState = { ok: false, message: "" };

export function DeleteStoreButton({ storeId, storeName }: { storeId: string; storeName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState(deleteStoreAction, initialState);
  const confirmed = confirmation.trim() === storeName;

  useEffect(() => {
    if (!state.ok) return;
    const timeoutId = window.setTimeout(() => {
      setOpen(false);
      setConfirmation("");
      router.refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [router, state.ok]);

  return (
    <>
      <button
        type="button"
        aria-label={`Delete ${storeName}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-red-400/70 bg-red-500/10 px-3 text-sm font-bold text-red-200 transition hover:bg-red-500/18 hover:text-red-100"
      >
        <Trash2 size={16} />
        Delete
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-store-${storeId}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-red-300/30 bg-[#120706] p-6 text-left shadow-[0_28px_110px_rgba(0,0,0,0.62)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full border border-red-300/40 bg-red-500/12 text-red-200">
                  <AlertTriangle size={26} />
                </span>
                <div>
                  <h2 id={`delete-store-${storeId}`} className="text-2xl font-extrabold text-white">Delete {storeName}</h2>
                  <p className="mt-2 text-sm leading-6 text-red-100/82">
                    This will permanently remove this store and its connected managers, receptionists, products, inventory, and sales data from the system.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmation("");
                }}
                className="grid size-9 place-items-center rounded-full border border-white/12 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close delete confirmation"
              >
                <X size={18} />
              </button>
            </div>

            <form action={formAction} className="space-y-5">
              <input type="hidden" name="storeId" value={storeId} />
              <label className="block">
                <span className="text-sm font-bold text-white/86">Type &quot;{storeName}&quot; to confirm deletion.</span>
                <input
                  name="confirmStoreName"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="mt-3 h-12 w-full rounded-lg border border-red-300/30 bg-black/35 px-4 text-white outline-none transition placeholder:text-white/35 focus:border-red-200/70"
                  autoComplete="off"
                />
              </label>

              {state.message ? <p className={`rounded-lg border px-4 py-3 text-sm font-semibold ${state.ok ? "border-lime-300/25 bg-lime-500/10 text-lime-200" : "border-red-300/30 bg-red-500/10 text-red-100"}`}>{state.message}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmation("");
                  }}
                  disabled={pending}
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-white/16 px-5 font-bold text-white/75 transition hover:bg-white/8 hover:text-white disabled:cursor-wait disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!confirmed || pending}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-red-300/70 bg-red-600/30 px-5 font-extrabold text-red-50 transition hover:bg-red-600/45 disabled:cursor-not-allowed disabled:border-white/12 disabled:bg-white/8 disabled:text-white/35"
                >
                  <Trash2 size={18} />
                  {pending ? "Deleting..." : "Delete Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
