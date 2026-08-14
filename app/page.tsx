import Link from "next/link";
import { BriefcaseBusiness, ShieldCheck, Settings, UserRound } from "lucide-react";
import { AccessBadge, AccountHero, ArrowCue, GlassPanel, SecureNotice } from "@/components/AccountChrome";
import { accountTypes } from "@/lib/account-data";

const icons = {
  employee_receptionist: UserRound,
  manager: BriefcaseBusiness,
  owner: ShieldCheck,
  tenant_admin: Settings
};

export default function AccountTypesPage() {
  return (
    <main>
      <AccountHero eyebrow="Welcome to" title="GreenChoice" body="Select the type of user you want to manage or register in the system." />
      <section className="mx-auto max-w-[1500px] px-4 pb-8">
        <GlassPanel className="-mt-8 md:p-10">
          <div className="text-center">
            <h1 className="text-4xl font-bold md:text-5xl">Account <span className="text-lime-400">Types</span></h1>
            <p className="mt-4 text-xl text-white/70">Choose the type of user account to manage or create.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {accountTypes.map((item) => {
              const Icon = icons[item.role as keyof typeof icons] ?? UserRound;
              return (
                <Link key={item.role} href={item.href as never} className="group rounded-lg border border-white/12 bg-white/[0.025] p-8 text-center transition hover:border-lime-400/50 hover:bg-lime-400/[0.055]">
                  <span className="mx-auto grid size-28 place-items-center rounded-full border border-lime-400 text-lime-400">
                    <Icon size={44} strokeWidth={1.4} />
                  </span>
                  <h2 className="mt-6 text-3xl font-bold">{item.title}</h2>
                  <p className="mx-auto mt-4 max-w-sm text-lg leading-8 text-white/70">{item.body}</p>
                  <div className="mt-7 flex items-center justify-center gap-12">
                    <AccessBadge>{item.access}</AccessBadge>
                    <ArrowCue />
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-8">
            <SecureNotice />
          </div>
        </GlassPanel>
      </section>
    </main>
  );
}
