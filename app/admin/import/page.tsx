import { importProductsAction } from "@/app/actions";

export default function ImportPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Import seed/catalog JSON</h1>
      <p className="mt-2 text-sm text-white/55">Admin-only validation surface. Dry-run first, review row-level validation, then commit. Files are parsed server-side and scoped to the active store.</p>
      <form action={importProductsAction} className="mt-5 space-y-4">
        <fieldset className="rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-sm font-semibold">Import mode</legend>
          <label className="mr-4 inline-flex items-center gap-2 text-sm"><input type="radio" name="mode" value="dry_run" defaultChecked /> Dry-run validation</label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="mode" value="commit" /> Commit after review</label>
        </fieldset>
        <textarea name="json" className="min-h-96 w-full rounded-lg border border-white/10 bg-ink p-4 font-mono text-sm" defaultValue={'{\n  "products": []\n}'} />
        <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100" role="status">
          Commit mode should only be used after a clean dry run. Unknown product fields are rejected.
        </div>
        <button className="rounded-lg bg-mint px-4 py-2 font-semibold text-ink focus:outline focus:outline-2 focus:outline-white">Review import</button>
      </form>
    </main>
  );
}
