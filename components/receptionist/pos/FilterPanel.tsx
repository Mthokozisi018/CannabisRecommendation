"use client";

import type { Ref } from "react";
import type { ReceptionistCategory } from "@/lib/receptionist/products";
import type { CultivationOption, POSMessage, SubcategoryOption } from "@/components/receptionist/pos/pos-types";
import { subcategoryKey } from "@/components/receptionist/pos/pos-helpers";

export function FilterPanel({
  message,
  visibleCategories,
  category,
  showCultivationFilter,
  cultivationType,
  subcategory,
  subcategoryOptions,
  cultivationOptions,
  strainPanelRef,
  visualStyle = "default",
  onSelectCategory,
  onSelectCultivationType,
  onSelectSubcategory
}: {
  message: POSMessage | null;
  visibleCategories: ReceptionistCategory[];
  category: string;
  showCultivationFilter: boolean;
  cultivationType: string;
  subcategory: string;
  subcategoryOptions: SubcategoryOption[];
  cultivationOptions: CultivationOption[];
  strainPanelRef?: Ref<HTMLDivElement>;
  visualStyle?: "default" | "receptionist";
  onSelectCategory: (category: string) => void;
  onSelectCultivationType: (cultivationType: string) => void;
  onSelectSubcategory: (subcategory: string) => void;
}) {
  const receptionistNav = visualStyle === "receptionist";
  const categoryButtonClass = (active: boolean) =>
    receptionistNav
      ? active
        ? "border-2 border-emerald-300 bg-[linear-gradient(180deg,#0b5b35,#07351f)] text-white shadow-[0_0_18px_rgba(34,197,94,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] hover:border-emerald-200 hover:bg-[linear-gradient(180deg,#0d6a3e,#084426)] hover:shadow-[0_0_24px_rgba(34,197,94,0.36),inset_0_1px_0_rgba(255,255,255,0.16)]"
        : "border-2 border-white/55 bg-[linear-gradient(180deg,#111714,#070c09)] text-white/84 shadow-[0_0_12px_rgba(34,197,94,0.09),inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-emerald-300/80 hover:bg-[linear-gradient(180deg,#10261a,#08110c)] hover:text-white hover:shadow-[0_0_18px_rgba(34,197,94,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]"
      : active
        ? "border-emerald-400 bg-emerald-500/15 text-white"
        : "border-white/12 bg-white/[0.055] text-white/75";
  const filterContainerClass = receptionistNav
    ? "mb-2 w-fit max-w-full rounded-xl border-2 border-white/45 bg-[linear-gradient(145deg,#102117,#070c09)] p-2 shadow-[0_0_18px_rgba(34,197,94,0.12),inset_0_1px_0_rgba(255,255,255,0.09)]"
    : "mb-3 rounded-xl border border-emerald-400/16 bg-emerald-950/20 p-3";
  const cultivationContainerClass = receptionistNav
    ? "mb-3 w-fit max-w-full rounded-xl border-2 border-white/45 bg-[linear-gradient(145deg,#102117,#070c09)] p-2 shadow-[0_0_18px_rgba(34,197,94,0.12),inset_0_1px_0_rgba(255,255,255,0.09)]"
    : "mb-4 rounded-xl border border-emerald-400/16 bg-emerald-950/20 p-3";
  const filterButtonClass = (active: boolean) =>
    receptionistNav
      ? active
        ? "border-2 border-emerald-300 bg-[linear-gradient(180deg,#0b5b35,#07351f)] text-white shadow-[0_0_17px_rgba(34,197,94,0.3),inset_0_1px_0_rgba(255,255,255,0.14)] hover:border-emerald-200 hover:bg-[linear-gradient(180deg,#0d6a3e,#084426)] hover:shadow-[0_0_23px_rgba(34,197,94,0.36),inset_0_1px_0_rgba(255,255,255,0.16)]"
        : "border-2 border-white/45 bg-[linear-gradient(180deg,#111714,#070c09)] text-white/78 shadow-[0_0_10px_rgba(34,197,94,0.08),inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-emerald-300/80 hover:bg-[linear-gradient(180deg,#10261a,#08110c)] hover:text-white hover:shadow-[0_0_17px_rgba(34,197,94,0.18),inset_0_1px_0_rgba(255,255,255,0.1)]"
      : active
        ? "border-emerald-400 bg-emerald-500/20 text-white shadow-[0_0_22px_rgba(16,185,129,0.18)]"
        : "border-white/12 bg-white/[0.045] text-white/72";

  return (
    <>
      {message ? <p className={`mb-3 rounded-xl border px-3 py-2 text-sm font-semibold ${message.tone === "success" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-200" : "border-red-300/35 bg-red-500/10 text-red-100"}`}>{message.text}</p> : null}

      <div className="mb-2 flex w-fit max-w-full gap-2 overflow-x-auto pb-1">
        {visibleCategories.map((item) => (
          <button key={item.slug} onClick={() => onSelectCategory(item.slug)} className={`min-w-fit rounded-xl border px-5 py-2.5 text-sm transition focus-visible:ring-2 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503] ${categoryButtonClass(category === item.slug)}`}>
            {item.name}
          </button>
        ))}
      </div>

      {subcategoryOptions.length > 0 ? (
        <div ref={strainPanelRef} className={filterContainerClass}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {subcategoryOptions.map((item) => (
              <button key={subcategoryKey(item.value)} onClick={() => onSelectSubcategory(item.value)} className={`min-w-fit rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503] ${filterButtonClass(subcategoryKey(subcategory) === subcategoryKey(item.value))}`}>
                {item.label}
                <span className="ml-2 text-xs text-white/45">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showCultivationFilter && subcategory ? (
        <div className={cultivationContainerClass}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cultivationOptions.map((item) => (
              <button key={item.value} onClick={() => onSelectCultivationType(item.value)} className={`min-w-fit rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503] ${filterButtonClass(cultivationType === item.value)}`}>
                {item.label}
                <span className="ml-2 text-xs text-white/45">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
