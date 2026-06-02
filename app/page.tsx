import { ArrowRight, Leaf, Moon, Smile, Sparkles, Target, Zap } from "lucide-react";
import { startRecommendationSession } from "./actions";
import { listEffects } from "@/lib/dal/catalog";
import type { EffectDTO } from "@/lib/types";

const icons = { relaxed: Leaf, focused: Target, creative: Sparkles, sleepy: Moon, euphoric: Smile, energetic: Zap };

export default async function HomePage() {
  const effects = await listEffects();
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <section className="grid min-h-[calc(100vh-112px)] content-center gap-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">Staff recommendation session</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-6xl">GreenChoice Dispensary Workstation</h1>
          <p className="mt-4 text-lg text-white/65">Choose the customer's desired effect tag to start ranked, in-store recommendations. Effect and benefit labels are informational product metadata, not medical claims.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {effects.map((item: EffectDTO) => {
            const Icon = icons[item.slug as keyof typeof icons] ?? Leaf;
            return (
              <form key={item.slug} action={startRecommendationSession}>
                <input type="hidden" name="effect" value={item.slug} />
                <button className="group flex min-h-48 w-full flex-col justify-between rounded-lg border border-white/10 bg-white/[0.045] p-6 text-left shadow-glow transition hover:border-mint/50 hover:bg-white/[0.07]">
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
