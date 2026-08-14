"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center p-6 text-white">
      <section className="w-full max-w-xl rounded-lg border border-lime-400/35 bg-[#07100d] p-8 text-center">
        <h1 className="text-3xl font-extrabold">Dashboard request failed</h1>
        <p className="mt-4 text-white/70">The dashboard could not load this request. Please try again.</p>
        <button type="button" onClick={reset} className="mt-6 h-12 rounded-md bg-lime-500 px-7 font-extrabold text-black">
          Try again
        </button>
      </section>
    </main>
  );
}
