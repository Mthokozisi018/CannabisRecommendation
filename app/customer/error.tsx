"use client";

export default function CustomerError({ reset }: { reset: () => void }) {
  return <section role="alert" className="mx-auto my-8 max-w-2xl border border-[#405347] bg-[#08100b] p-6">
    <h1 className="text-2xl font-black">This page could not load</h1><p className="mt-3 text-[#aab4ac]">Please try again.</p>
    <button onClick={reset} className="mt-5 min-h-11 bg-[#a8e91d] px-5 font-black text-[#081000]">Try again</button>
  </section>;
}
