"use client";
import Link from "next/link";
export default function Error({ reset }: { reset:() => void }) {
  return <main className="min-h-screen bg-[#061b16] p-8 text-white"><h1 className="text-2xl font-bold">Supply requests unavailable</h1><p className="my-4">We could not verify your franchise store or load its supply information. Please retry or return to Suppliers.</p><div className="flex gap-5"><button onClick={reset} className="rounded-lg border border-green-500 px-5 py-3">Retry</button><Link className="px-5 py-3" href="/dashboard/manager/suppliers">Back to Suppliers</Link></div></main>;
}
