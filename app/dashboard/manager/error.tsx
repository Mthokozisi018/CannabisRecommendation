"use client";

export default function ManagerDashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#071008] px-4 text-white">
      <section className="max-w-lg rounded-2xl border-2 border-red-400 bg-[#180b0b] p-8 text-center">
        <h1 className="text-2xl font-black">Manager dashboard is unavailable</h1>
        <p className="mt-3 text-white/70">The dashboard could not be loaded safely. Please retry.</p>
        <button type="button" onClick={reset} className="mt-6 rounded-xl bg-[#72d943] px-5 py-3 font-black text-[#071007]">Try again</button>
      </section>
    </main>
  );
}
