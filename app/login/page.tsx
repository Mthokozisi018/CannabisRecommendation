import Link from "next/link";
import { Eye, LogIn, LockKeyhole, Mail } from "lucide-react";
import { loginGreenChoiceStaffAction } from "@/app/actions";

function LoginBackground() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-[#060b0b]">
      <div className="absolute -left-36 -top-44 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(115,196,84,0.46)_0%,rgba(58,126,50,0.19)_42%,transparent_68%)] blur-3xl" />
      <div className="absolute -right-28 bottom-0 size-[560px] rounded-full bg-[radial-gradient(circle,rgba(119,202,85,0.52)_0%,rgba(60,133,54,0.19)_45%,transparent_70%)] blur-3xl" />
      <div className="absolute left-[8%] top-[-10%] h-[420px] w-[520px] rounded-[55%] border border-lime-500/50 opacity-55 [transform:rotate(-48deg)]" />
      <div className="absolute -right-[12%] top-[14%] h-[410px] w-[650px] rounded-[52%] border border-lime-500/45 opacity-55 [transform:rotate(-28deg)]" />
      <div className="absolute -left-[17%] bottom-[18%] h-[430px] w-[610px] rounded-[55%] border border-lime-500/45 opacity-55 [transform:rotate(-24deg)]" />
      <div className="absolute right-[-7%] bottom-[-8%] h-[470px] w-[600px] rounded-[55%] border border-lime-500/45 opacity-55 [transform:rotate(-33deg)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,0.045),transparent_32%),linear-gradient(120deg,rgba(35,79,51,0.25),transparent_34%,rgba(9,14,14,0.7)_68%)]" />
    </div>
  );
}

function GreenChoiceMark() {
  return (
    <div className="mx-auto grid size-32 place-items-center">
      <svg viewBox="0 0 120 120" className="size-28 drop-shadow-[0_12px_26px_rgba(117,211,82,0.28)]" role="img" aria-label="GreenChoice logo">
        <defs>
          <linearGradient id="leafGradient" x1="21" x2="94" y1="22" y2="94" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9fe766" />
            <stop offset=".55" stopColor="#65bb45" />
            <stop offset="1" stopColor="#2f6e35" />
          </linearGradient>
          <linearGradient id="stemGradient" x1="28" x2="64" y1="30" y2="101" gradientUnits="userSpaceOnUse">
            <stop stopColor="#b7f179" />
            <stop offset="1" stopColor="#315f31" />
          </linearGradient>
        </defs>
        <path d="M93 51c-2-24-22-38-45-32 26 13 38 33 34 61 13-5 19-16 11-29Z" fill="url(#leafGradient)" />
        <path d="M31 20c30 12 50 31 56 63-31 2-54-22-56-63Z" fill="url(#leafGradient)" />
        <path d="M35 25c6 23 17 43 38 62" fill="none" stroke="#17351f" strokeLinecap="round" strokeWidth="4" />
        <path d="M48 88c-16-8-25-23-21-44-15 23-3 47 23 57 15 6 29 3 42-7-14 3-29 1-44-6Z" fill="#1f542c" opacity=".88" />
        <path d="M78 30a39 39 0 1 1-49 23" fill="none" stroke="url(#stemGradient)" strokeLinecap="round" strokeWidth="8" />
        <path d="M59 66c-5 18-8 30-8 41" fill="none" stroke="#2a5e2d" strokeLinecap="round" strokeWidth="6" />
      </svg>
    </div>
  );
}

function LoginField({ label, icon, name, placeholder, type = "text", trailing }: { label: string; icon: React.ReactNode; name: string; placeholder: string; type?: string; trailing?: React.ReactNode }) {
  return (
    <label className="block text-[17px] font-semibold text-white/95">
      {label}
      <span className="mt-3 flex h-[78px] items-center gap-5 rounded-xl border border-white/22 bg-[#111719]/70 px-7 text-white/48 shadow-[inset_0_0_0_1px_rgba(130,170,142,0.08)] transition focus-within:border-[#72d654]/75 focus-within:bg-[#12191b]/90">
        <span className="text-[#72d654]">{icon}</span>
        <input name={name} type={type} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[20px] text-white outline-none placeholder:text-white/42" />
        {trailing}
      </span>
    </label>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-7 text-[17px] text-white/58">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/24 to-white/16" />
      <span>or</span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/16 via-white/24 to-transparent" />
    </div>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorMessage = error === "staff"
    ? "This login is only for GreenChoice staff accounts."
    : error === "unavailable"
      ? "GreenChoice authentication is not reachable. Check the backend API configuration."
      : error
        ? "Invalid GreenChoice staff email or password."
        : "";

  return (
    <main className="relative isolate grid min-h-screen place-items-center overflow-hidden px-5 py-10 text-white sm:px-8">
      <LoginBackground />
      <section className="relative w-full max-w-[840px] rounded-[30px] border border-white/28 bg-[linear-gradient(145deg,rgba(32,42,39,0.84),rgba(7,12,13,0.9)_48%,rgba(10,16,16,0.96))] px-6 py-12 shadow-[0_42px_120px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl sm:px-12 md:px-[62px] md:py-16">
        <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_5%_2%,rgba(255,255,255,0.16),transparent_22%),radial-gradient(circle_at_86%_92%,rgba(111,199,82,0.46),transparent_18%),radial-gradient(circle_at_50%_58%,rgba(92,197,65,0.11),transparent_30%)]" />
        <div className="relative">
          <GreenChoiceMark />
          <div className="mt-1 text-center">
            <p className="text-[28px] font-light uppercase tracking-[0.18em] text-white sm:text-[36px]">
              <span className="font-extrabold text-[#74ce50]">Green</span>Choice
            </p>
            <p className="mt-3 text-[19px] text-white/63 sm:text-[23px]">Inventory Management System</p>
          </div>

          <div className="mx-auto my-11 h-px max-w-[550px] bg-gradient-to-r from-transparent via-white/18 to-transparent">
            <div className="mx-auto h-px w-28 bg-[#78e356] shadow-[0_0_18px_4px_rgba(120,227,86,0.62)]" />
          </div>

          <div className="text-center">
            <h1 className="text-[42px] font-extrabold leading-none tracking-normal text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] sm:text-[50px]">Hi there! <span aria-hidden="true">👋</span></h1>
            <p className="mt-6 text-[23px] text-white/64">Sign in to access your account</p>
          </div>

          <form action={loginGreenChoiceStaffAction} className="mt-14 grid gap-9">
            {errorMessage ? <p className="rounded-xl border border-red-300/25 bg-red-500/10 px-5 py-4 text-center text-red-100">{errorMessage}</p> : null}
            <LoginField name="email" label="Email Address" icon={<Mail size={31} strokeWidth={2.2} />} placeholder="Enter your work email" type="email" />
            <LoginField name="password" label="Password" icon={<LockKeyhole size={31} strokeWidth={2.2} />} placeholder="Enter your password" type="password" trailing={<button type="button" className="grid size-10 place-items-center rounded-full text-white/72 transition hover:bg-white/8 hover:text-white" aria-label="Show password"><Eye size={30} strokeWidth={2.1} /></button>} />
            <button type="submit" className="mt-5 inline-flex h-[82px] items-center justify-center gap-6 rounded-xl bg-[linear-gradient(135deg,#78d95b,#55a93e)] text-[26px] font-extrabold text-white shadow-[0_24px_55px_rgba(89,188,65,0.32),inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:brightness-110 active:translate-y-px">
              <LogIn size={34} strokeWidth={2.2} />
              Sign In
            </button>
          </form>

          <div className="mx-auto mt-14 max-w-[670px]">
            <Divider />
            <Link href="/register" className="mx-auto mt-8 flex w-fit items-center gap-4 rounded-lg px-4 py-3 text-[20px] font-semibold text-[#70d84d] transition hover:bg-lime-400/10 hover:text-[#8ef46b]">
              <LockKeyhole size={23} strokeWidth={2.2} />
              Forgot Password?
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
