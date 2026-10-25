export const groupedTableStyles = {
  control: "h-12 w-full rounded-xl border-2 border-[#405347] bg-[#0a100c] px-3 text-sm font-bold text-white outline-none transition focus:border-[#72d943] focus:ring-2 focus:ring-[#72d943]/25 disabled:opacity-60",
  frame: "overflow-hidden rounded-2xl border-[3px] border-[#405347] bg-[#080d09] shadow-2xl",
  heading: "border-b-[3px] border-[#405347] bg-[#101a12] px-4 py-4 sm:px-5",
  columns: "hidden gap-3 border-b-2 border-[#405347] bg-[#18351e] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#b8f09f] md:grid",
  record: "border-b-2 border-[#28362d] last:border-b-0",
  row: "grid w-full gap-3 bg-[#0a100c] px-4 py-4 text-left transition hover:bg-[#122017] focus:bg-[#122017] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#72d943] md:items-center md:px-5",
  detail: "border-t-2 border-[#72d943] bg-[#111a13] px-4 py-4 sm:px-5",
  itemTable: "w-full min-w-[680px] border-separate border-spacing-0 text-sm",
  itemHeader: "bg-[#18351e] text-left text-xs uppercase tracking-wider text-[#b8f09f]",
  itemRow: "bg-[#090e0a]"
} as const;
