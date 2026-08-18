import Link from "next/link";
import { LockKeyhole, UserPlus } from "lucide-react";
import { Suspense } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { LoginForm } from "@/app/login/LoginForm";

function LoginBackground() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-[#060b0b]">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70 saturate-125" style={{ backgroundImage: "linear-gradient(120deg,rgba(0,0,0,0.5),rgba(0,0,0,0.24)),url('/images/backgrounds/receptionist-pos-wallpaper.png')" }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(127,255,74,0.08),transparent_30%),linear-gradient(180deg,rgba(2,8,7,0.3),rgba(0,0,0,0.68))]" />
    </div>
  );
}

function GreenChoiceMark() {
  return (
    <div className="mx-auto grid size-24 place-items-center">
      <svg viewBox="0 0 120 120" className="size-20 drop-shadow-[0_10px_22px_rgba(117,211,82,0.24)]" role="img" aria-label="GreenChoice logo">
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

function Divider() {
  return (
    <div className="flex items-center gap-5 text-sm text-white/58">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/24 to-white/16" />
      <span>or</span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/16 via-white/24 to-transparent" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="gc-login-page relative isolate grid min-h-screen place-items-center overflow-hidden px-5 py-6 text-white sm:px-8">
      <LoginBackground />
      <section className="gc-login-panel relative w-full max-w-[640px] rounded-[24px] border border-white/28 bg-[linear-gradient(145deg,rgba(32,42,39,0.84),rgba(7,12,13,0.9)_48%,rgba(10,16,16,0.96))] px-5 py-8 shadow-[0_34px_96px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl sm:px-9 md:px-12 md:py-10">
        <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_5%_2%,rgba(255,255,255,0.16),transparent_22%),radial-gradient(circle_at_86%_92%,rgba(111,199,82,0.46),transparent_18%),radial-gradient(circle_at_50%_58%,rgba(92,197,65,0.11),transparent_30%)]" />
        <div className="relative">
          <GreenChoiceMark />
          <div className="mt-1 text-center">
            <p className="text-2xl font-light uppercase tracking-[0.18em] text-white sm:text-[30px]">
              <span className="font-extrabold text-[#74ce50]">Green</span>Choice
            </p>
            <p className="mt-2 text-base text-white/63 sm:text-lg">Inventory Management System</p>
          </div>

          <div className="mx-auto my-8 h-px max-w-[430px] bg-gradient-to-r from-transparent via-white/18 to-transparent">
            <div className="mx-auto h-px w-20 bg-[#78e356] shadow-[0_0_14px_3px_rgba(120,227,86,0.5)]" />
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-extrabold leading-none tracking-normal text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] sm:text-[42px]">Hi there! <span aria-hidden="true">👋</span></h1>
            <p className="mt-4 text-lg text-white/64">Sign in to access your account</p>
          </div>

          <Suspense fallback={<LoadingOverlay />}>
            <LoginForm />
          </Suspense>

          <div className="mx-auto mt-9 max-w-[520px]">
            <Divider />
            <Link href="/forgot-password" className="mx-auto mt-5 flex w-fit items-center gap-3 rounded-lg px-3 py-2 text-base font-semibold text-[#70d84d] transition hover:bg-lime-400/10 hover:text-[#8ef46b]">
              <LockKeyhole size={19} strokeWidth={2.2} />
              Forgot Password?
            </Link>
            <Link href={"/forgot-account" as never} className="mx-auto mt-1 flex w-fit items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/8 hover:text-white">
              Forgot Customer Account Details?
            </Link>
            <Link href={"/customer/register" as never} className="mx-auto mt-2 flex h-12 w-full max-w-sm items-center justify-center gap-3 rounded-xl border-2 border-[#70d84d] bg-[#70d84d]/10 px-4 text-base font-extrabold text-[#8ef46b] transition hover:bg-[#70d84d]/20">
              <UserPlus size={20} strokeWidth={2.2} />
              Create Customer Account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
