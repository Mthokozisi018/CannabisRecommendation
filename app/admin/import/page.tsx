import { importProductsAction } from "@/app/actions";

export default function ImportPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Import seed/catalog JSON</h1>
      <p className="mt-2 text-sm text-white/55">Admin-only validation surface. Writes should be executed through the server DAL with Supabase service credentials.</p>
      <form action={importProductsAction} className="mt-5 space-y-4">
        <textarea name="json" className="min-h-96 w-full rounded-lg border border-white/10 bg-ink p-4 font-mono text-sm" defaultValue={'{\n  "products": []\n}'} />
        <button className="rounded-lg bg-mint px-4 py-2 font-semibold text-ink">Validate import</button>
      </form>
    </main>
  );
}
