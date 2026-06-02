import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const enabled = Boolean(await createSupabaseServerClient());
  return (
    <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-md content-center px-4">
      <section className="rounded-lg border border-white/10 bg-panel p-6 shadow-glow">
        <h1 className="text-2xl font-semibold">Staff login</h1>
        <p className="mt-2 text-sm text-white/55">{enabled ? "Supabase Auth is configured. Add your cookie login action here for production." : "Local preview mode is active with sample admin staff."}</p>
        <form className="mt-6 space-y-4">
          <label className="block text-sm">Email<input className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-ink px-3" defaultValue="admin@greenchoice.local" /></label>
          <label className="block text-sm">Password<input type="password" className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-ink px-3" defaultValue="GreenChoiceLocal123!" /></label>
          <button className="h-11 w-full rounded-lg bg-mint font-semibold text-ink" disabled>Cookie auth placeholder</button>
        </form>
      </section>
    </main>
  );
}
