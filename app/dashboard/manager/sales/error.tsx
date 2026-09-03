"use client";

export default function ManagerSalesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#071008] px-4 text-white"><section className="max-w-lg rounded-2xl border-[3px] border-red-400 bg-[#180b0b] p-8 text-center"><h1 className="text-2xl font-black">Sales Overview is unavailable</h1><p className="mt-3 text-white/70">We could not load the report. No database details were exposed or changed.</p><button type="button" onClick={reset} className="mt-6 rounded-xl border-2 border-[#72d943] bg-[#72d943] px-5 py-2.5 font-black text-[#071007]">Try again</button></section></main>;
}
