import Link from "next/link";
import { ArrowLeft, Leaf, LucideIcon, Sprout } from "lucide-react";

export function DashboardBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050909]">
      <div className="absolute -left-28 -top-24 size-[430px] rounded-full bg-[radial-gradient(circle,rgba(109,210,75,0.26),transparent_68%)] blur-3xl" />
      <div className="absolute bottom-[-140px] right-[-120px] size-[520px] rounded-full bg-[radial-gradient(circle,rgba(93,186,70,0.32),transparent_70%)] blur-3xl" />
      <div className="absolute left-[6%] top-[12%] h-[360px] w-[520px] rounded-[55%] border border-lime-500/25 [transform:rotate(-35deg)]" />
      <div className="absolute right-[-15%] top-[20%] h-[430px] w-[680px] rounded-[55%] border border-lime-500/20 [transform:rotate(-26deg)]" />
    </div>
  );
}

export function DashboardHeader({ title, subtitle, profileLabel }: { title: string; subtitle: string; profileLabel: string }) {
  return (
    <header className="flex flex-col gap-5 pb-8 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <span className="grid size-12 place-items-center rounded-2xl border border-lime-300/20 bg-lime-400/10 text-lime-300 shadow-[0_0_30px_rgba(132,229,89,0.22)]">
          <Sprout size={30} />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-lime-300">GreenChoice</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-2 text-white/62">{subtitle}</p>
        </div>
      </div>
      <div className="w-fit rounded-full border border-white/12 bg-white/[0.055] px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur">
        {profileLabel}
      </div>
    </header>
  );
}

export function DashboardCard({ href, icon: Icon = Leaf, title, text }: { href: string; icon?: LucideIcon; title: string; text: string }) {
  return (
    <Link href={href as never} className="group flex min-h-56 flex-col justify-between rounded-2xl border border-white/12 bg-white/[0.055] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-lime-300/55 hover:bg-lime-400/[0.075] hover:shadow-[0_25px_80px_rgba(94,202,64,0.16)]">
      <span className="grid size-14 place-items-center rounded-2xl bg-lime-400/12 text-lime-300 shadow-[0_0_28px_rgba(132,229,89,0.18)]">
        <Icon size={30} />
      </span>
      <span>
        <span className="block text-2xl font-bold text-white">{title}</span>
        <span className="mt-2 block text-sm leading-6 text-white/58">{text}</span>
      </span>
      <span className="text-sm font-semibold text-lime-300 transition group-hover:translate-x-1">Open</span>
    </Link>
  );
}

export function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/12 bg-white/[0.055] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.25)] backdrop-blur-xl ${className}`}>{children}</section>;
}

export function BackLink({ href }: { href: string }) {
  return (
    <Link href={href as never} className="mb-6 inline-flex h-11 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-4 text-sm font-semibold text-white/72 transition hover:border-lime-300/45 hover:text-lime-300">
      <ArrowLeft size={17} />
      Back
    </Link>
  );
}

export function Money({ value }: { value: string | number }) {
  return <>{new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(value))}</>;
}
