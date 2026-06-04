import { ArrowRight, Leaf, Moon, Smile, Sparkles, Target, Zap } from "lucide-react";
import { startRecommendationSession } from "@/app/actions";
import { listEffects } from "@/lib/dal/catalog";
import type { EffectDTO } from "@/lib/types";
import { requirePermission } from "@/lib/dal/auth";

export const dynamic = "force-dynamic";

const icons = { relaxed: Leaf, focused: Target, creative: Sparkles, sleepy: Moon, euphoric: Smile, energetic: Zap };

export default async function ReceptionistDashboardPage() {
  await requirePermission("recommendation.start");
  const effects = await listEffects();
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <section className="grid min-h-[calc(100vh-152px)] content-center gap-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">Receptionist dashboard</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-6xl">Welcome back, <span className="text-lime-400">Receptionist</span></h1>
          <p className="mt-4 text-lg text-white/65">Start staff-assisted recommendations with low-risk wellness and preference language. Product metadata is informational, not medical advice.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {effects.map((item: EffectDTO) => {
            const Icon = icons[item.slug as keyof typeof icons] ?? Leaf;
            return (
              <form key={item.slug} action={startRecommendationSession}>
                <button className="group flex min-h-48 w-full flex-col justify-between rounded-lg border border-white/10 bg-white/[0.045] p-6 text-left shadow-glow transition hover:border-mint/50 hover:bg-white/[0.07]">
                  <input type="hidden" name="effect" value={item.slug} />
                  <span className="grid size-12 place-items-center rounded-lg bg-mint/12 text-mint"><Icon size={26} /></span>
                  <span>
                    <span className="block text-2xl font-semibold">{item.name}</span>
                    <span className="mt-2 block text-sm text-white/55">{item.description}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-mint">Start <ArrowRight className="transition group-hover:translate-x-1" size={17} /></span>
                </button>
              </form>
            );
          })}
        </div>
      </section>
    </main>
  );
}
