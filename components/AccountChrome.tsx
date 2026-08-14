import Link from "next/link";
import { ArrowRight, Leaf, LockKeyhole, ShieldCheck } from "lucide-react";

export function BrandWordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-3">
      <Leaf className="size-12 text-lime-400" strokeWidth={1.4} />
      <span className="text-2xl font-semibold"><span className="text-lime-400">Green</span>Choice<span className="block text-sm font-normal text-white/75">Dispensary System</span></span>
    </Link>
  );
}

export function AccountHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_12%,rgba(151,204,12,0.34),transparent_24%),linear-gradient(110deg,#050807_0%,#07100d_48%,#151c0f_100%)]" />
      <div className="absolute right-0 top-0 hidden h-full w-1/2 opacity-80 md:block">
        <div className="h-full w-full bg-[radial-gradient(circle_at_55%_24%,#b6e21a_0%,#384b15_10%,transparent_28%),radial-gradient(circle_at_58%_36%,rgba(122,172,19,0.5),transparent_25%),linear-gradient(135deg,transparent,#06100c)]" />
      </div>
      <div className="relative mx-auto max-w-[1500px] px-6 py-10 md:py-14">
        <BrandWordmark />
        <div className="mt-16 max-w-xl">
          <p className="text-3xl font-semibold">{eyebrow}</p>
          <h1 className="mt-2 text-5xl font-bold leading-none md:text-7xl"><span className="text-lime-400">{title.split(" ")[0]}</span>{title.includes(" ") ? title.slice(title.indexOf(" ")) : ""}</h1>
          <p className="mt-6 max-w-md text-xl leading-8 text-white/82">{body}</p>
        </div>
      </div>
    </section>
  );
}

export function GlassPanel({ children, className = "", ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return <section className={`rounded-lg border border-white/12 bg-[#06100e]/82 p-6 shadow-glow backdrop-blur ${className}`} {...props}>{children}</section>;
}

export function AccessBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-lime-400/35 px-4 py-1.5 text-sm font-semibold text-lime-400">{children}</span>;
}

export function SecureNotice() {
  return (
    <GlassPanel className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <ShieldCheck className="size-14 text-lime-400" strokeWidth={1.5} />
        <div>
          <h2 className="text-xl font-semibold">Your data is secure with us</h2>
          <p className="mt-1 max-w-xl text-white/65">Account access, privacy requests, role changes and restricted content denials are logged for compliance review.</p>
        </div>
      </div>
      <LockKeyhole className="hidden size-16 text-lime-400/70 sm:block" strokeWidth={1.3} />
    </GlassPanel>
  );
}

export function ArrowCue() {
  return <ArrowRight className="text-lime-400 transition group-hover:translate-x-1" size={28} strokeWidth={1.6} />;
}
