import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Leaf, LogOut, LucideIcon, Sprout } from "lucide-react";
import { logoutGreenChoiceStaffAction } from "@/app/actions";

export function DashboardBackdrop(_props: { variant?: "manager" | "receptionist" | "admin" }) {
  const variant = _props.variant ?? "manager";
  const background = {
    admin: "/images/admin-dashboard-wallpaper.png",
    manager: "/images/manager-dashboard/new-manager-wallpaper.png",
    receptionist: "/images/backgrounds/receptionist-pos-wallpaper.png"
  }[variant];
  const manager = variant === "manager";

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050909]">
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${manager ? "opacity-100 saturate-110" : "opacity-62 saturate-125"}`}
        style={{ backgroundImage: manager ? `url(${background})` : `linear-gradient(120deg,rgba(0,0,0,0.48),rgba(0,0,0,0.2)),url(${background})` }}
      />
      {manager ? <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.56),rgba(0,0,0,0.24)_48%,rgba(0,0,0,0.58)),linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.68))]" /> : null}
      {!manager ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_8%,rgba(127,255,74,0.08),transparent_28%),linear-gradient(180deg,rgba(2,8,7,0.28),rgba(0,0,0,0.55))]" /> : null}
      {!manager ? <div className="absolute -left-28 -top-24 size-[430px] rounded-full bg-[radial-gradient(circle,rgba(109,210,75,0.3),transparent_68%)] blur-3xl" /> : null}
      {!manager ? <div className="absolute bottom-[-140px] right-[-120px] size-[560px] rounded-full bg-[radial-gradient(circle,rgba(93,186,70,0.34),transparent_70%)] blur-3xl" /> : null}
    </div>
  );
}

export function DashboardHeader({ title, subtitle, profileLabel }: { title: string; subtitle: string; profileLabel: string }) {
  return (
    <header className="relative flex flex-col items-center pb-10 text-center">
      <div className="mx-auto flex flex-col items-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="grid size-14 place-items-center rounded-full bg-[radial-gradient(circle,rgba(131,230,83,0.28),transparent_70%)] text-lime-300">
            <Leaf size={38} fill="currentColor" />
          </span>
          <p className="text-[28px] font-extrabold leading-none text-white">
            Green<span className="text-[#72d943]">Choice</span>
          </p>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight text-white drop-shadow-[0_5px_18px_rgba(0,0,0,0.55)] sm:text-5xl">{title}</h1>
          <p className="mt-4 text-xl leading-8 text-white/78">{subtitle}</p>
        </div>
      </div>
      <div className="mt-6 flex w-fit items-center gap-3 rounded-full border border-lime-400/35 bg-black/25 px-4 py-3 text-sm font-semibold text-white/90 shadow-[0_0_30px_rgba(115,215,70,0.16)] backdrop-blur-xl md:absolute md:right-0 md:top-0 md:mt-0">
        <span className="grid size-11 place-items-center rounded-full bg-lime-400/15 text-lime-200"><Sprout size={24} /></span>
        <span>{profileLabel}</span>
        <form action={logoutGreenChoiceStaffAction}>
          <button type="submit" aria-label="Log out" className="grid size-10 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white">
            <LogOut size={20} />
          </button>
        </form>
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
  return <section className={`rounded-[22px] border border-lime-400/25 bg-black/30 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl ${className}`}>{children}</section>;
}

export function VisualHeroPanel({ imageSrc, alt, children, className = "" }: { imageSrc: string; alt: string; children?: React.ReactNode; className?: string }) {
  return (
    <section className={`relative overflow-hidden rounded-[22px] border border-lime-400/25 bg-black/35 shadow-[0_28px_90px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl ${className}`}>
      <Image src={imageSrc} alt={alt} fill sizes="(min-width: 1024px) 70vw, 100vw" className="object-cover opacity-34 saturate-125" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.86),rgba(0,0,0,0.44)_55%,rgba(0,0,0,0.16))]" />
      <div className="relative p-6 sm:p-8">{children}</div>
    </section>
  );
}

export function ProductVisualPanel({ imageSrc, alt, children }: { imageSrc: string; alt: string; children?: React.ReactNode }) {
  return (
    <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border border-lime-400/25 bg-black/35">
      {/* Product cards accept Supabase URLs and local placeholders without Next image domain config. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc} alt={alt} className="absolute inset-0 size-full object-cover opacity-72 saturate-125 transition duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(132,229,89,0.16),transparent_42%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.62))]" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function BackLink({ href, visualStyle = "default" }: { href: string; visualStyle?: "default" | "receptionist" }) {
  const className = visualStyle === "receptionist"
    ? "mb-6 inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-400/30 bg-[#050b08] px-4 text-sm font-semibold text-white/82 shadow-[0_0_20px_rgba(34,197,94,0.14),0_10px_28px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-emerald-300/75 hover:bg-[#07130d] hover:text-lime-200 hover:shadow-[0_0_26px_rgba(34,197,94,0.25),0_10px_28px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.07)] focus-visible:ring-2 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503]"
    : "mb-6 inline-flex h-11 items-center gap-2 rounded-xl border border-lime-400/30 bg-black/35 px-4 text-sm font-semibold text-white/78 shadow-[0_0_24px_rgba(115,215,70,0.12)] backdrop-blur-xl transition hover:border-lime-300/65 hover:text-lime-300";

  return (
    <Link href={href as never} className={className}>
      <ArrowLeft size={17} />
      Back
    </Link>
  );
}

export function Money({ value }: { value: string | number }) {
  return <>{new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(value))}</>;
}
