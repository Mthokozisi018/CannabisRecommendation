export default function Loading() {
  return <main className="min-h-screen bg-[#071008] px-4 py-4 text-white sm:px-8">
    <div role="status" className="mx-auto max-w-[1296px] animate-pulse">
      <div className="mb-4 h-11 w-56 rounded-xl bg-[#29402e]" />
      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-52 rounded-2xl border-[4px] border-[#405347] bg-[#0a100c]" />)}
      </div>
      <div className="mt-4 h-32 rounded-2xl border-[3px] border-[#405347] bg-[#0a100c]" />
      <div className="mt-6 h-80 rounded-2xl border-[3px] border-[#405347] bg-[#0a100c]" />
      <span className="sr-only">Loading Sales Overview...</span>
    </div>
  </main>;
}
