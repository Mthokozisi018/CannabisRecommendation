"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-[#020503] p-6 text-white">
        <main className="w-full max-w-lg rounded-lg border border-lime-400/35 bg-[#07100d] p-8 text-center">
          <h1 className="text-3xl font-extrabold">GreenChoice is temporarily unavailable</h1>
          <p className="mt-4 text-white/70">Your request could not be completed. No changes should be assumed.</p>
          <button type="button" onClick={reset} className="mt-6 h-12 rounded-md bg-lime-500 px-7 font-extrabold text-black">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
