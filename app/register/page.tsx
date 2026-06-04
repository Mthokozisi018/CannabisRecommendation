import Link from "next/link";
import { ChevronDown, Eye, LockKeyhole, Mail, MapPin, Phone, UserPlus, UserRound, UsersRound } from "lucide-react";
import { AccountHero, GlassPanel } from "@/components/AccountChrome";
import { registerCustomerAction } from "@/app/actions";

function Field({ label, icon, placeholder, type = "text", name, required = true }: { label: string; icon: React.ReactNode; placeholder: string; type?: string; name: string; required?: boolean }) {
  return (
    <label className="block text-sm text-white/90">
      {label}{required ? "*" : ""}
      <span className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-white/15 bg-black/25 px-4 text-white/70 focus-within:border-lime-400/70">
        {icon}
        <input name={name} required={required} type={type} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/42" />
        {type === "password" ? <Eye size={20} /> : null}
      </span>
    </label>
  );
}

export default function RegisterPage() {
  return (
    <main>
      <AccountHero eyebrow="Welcome to" title="GreenChoice" body="Create your account to access the GreenChoice dispensary system." />
      <section className="mx-auto max-w-6xl px-4 pb-8">
        <GlassPanel className="-mt-8 md:px-16 md:py-10">
          <h1 className="text-4xl font-bold">Create <span className="text-lime-400">Customer</span> Account</h1>
          <p className="mt-4 text-lg text-white/72">Join GreenChoice with privacy-first onboarding. Cannabis-facing areas stay locked until adult and jurisdiction checks are complete.</p>
          <form action={registerCustomerAction} className="mt-8 grid gap-5">
            <Field label="Email Address" name="email" icon={<Mail size={22} />} placeholder="Enter your email address" type="email" />
            <div className="grid gap-5 md:grid-cols-[220px_1fr]">
              <label className="block text-sm text-white/90">
                Country code*
                <span className="mt-2 flex h-14 items-center justify-between rounded-lg border border-white/15 bg-black/25 px-4"><span>South Africa +27</span><ChevronDown size={18} /></span>
              </label>
              <Field label="Mobile Number" name="phone" icon={<Phone size={22} />} placeholder="Enter your mobile number" type="tel" />
            </div>
            <Field label="Choose Password" name="password" icon={<LockKeyhole size={22} />} placeholder="Enter your password" type="password" />
            <Field label="Confirm Password" name="confirmPassword" icon={<LockKeyhole size={22} />} placeholder="Confirm your password" type="password" />
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="First Name" name="firstName" icon={<UserRound size={22} />} placeholder="Enter your first name" />
              <Field label="Surname" name="surname" icon={<UserRound size={22} />} placeholder="Enter your surname" />
            </div>
            <label className="block text-sm text-white/90">
              Location*
              <span className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-white/15 bg-black/25 px-4 text-white/70"><MapPin size={22} /><select name="location" className="min-w-0 flex-1 bg-transparent outline-none"><option>South Africa</option><option>Gauteng</option><option>Western Cape</option></select><ChevronDown size={18} /></span>
            </label>
            <label className="block text-sm text-white/90">
              Gender
              <span className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-white/15 bg-black/25 px-4 text-white/70"><UsersRound size={22} /><select name="gender" className="min-w-0 flex-1 bg-transparent outline-none"><option value="">Prefer not to say</option><option>Woman</option><option>Man</option><option>Non-binary</option></select><ChevronDown size={18} /></span>
            </label>
            <div className="rounded-lg border border-white/12 bg-white/[0.035] p-5">
              <div className="flex gap-4">
                <UsersRound className="mt-1 text-lime-400" />
                <div>
                  <h2 className="font-semibold text-lime-400">Registering as a Customer</h2>
                  <p className="mt-1 text-white/68">This account is for preference profiles, recommendation history, bookings, privacy requests and security settings.</p>
                </div>
              </div>
            </div>
            <label className="flex items-start gap-3 text-white/75">
              <input name="marketingOptIn" type="checkbox" className="mt-1 size-5 rounded border-white/20 bg-transparent" />
              <span>I want to stay up to date with the latest from GreenChoice and special offers.</span>
            </label>
            <button className="inline-flex h-14 items-center justify-center gap-3 rounded-lg bg-lime-500 text-xl font-bold text-white shadow-glow transition hover:bg-lime-400">Create Customer Account <UserPlus /></button>
          </form>
          <div className="my-7 flex items-center gap-6 text-sm text-white/60"><span className="h-px flex-1 bg-white/16" />OR<span className="h-px flex-1 bg-white/16" /></div>
          <Link href="/login" className="flex h-14 items-center justify-center gap-3 rounded-lg border border-white/15 bg-black/20 text-xl font-semibold"><UserRound className="text-lime-400" />I already have an account</Link>
        </GlassPanel>
      </section>
    </main>
  );
}
