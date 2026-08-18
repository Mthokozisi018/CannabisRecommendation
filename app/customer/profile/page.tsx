import Link from "next/link";
import { Bell, Camera, ChevronRight, CircleHelp, Contact, Filter, Globe2, Heart, Info, LogOut, MapPin, Moon, ShieldCheck, UserRound } from "lucide-react";
import { logoutCustomerAction } from "@/app/customer/actions";
import { requireCustomerSession } from "@/lib/customer/auth";

const groups = [
  { title: "Account", items: [
    { href: "personal", label: "Personal Information", Icon: UserRound },
    { href: "addresses", label: "Addresses", Icon: MapPin },
    { href: "notifications", label: "Notifications", Icon: Bell },
    { href: "privacy", label: "Privacy & Security", Icon: ShieldCheck }
  ] },
  { title: "Preferences", items: [
    { href: "categories", label: "Favourite Categories", Icon: Heart },
    { href: "filters", label: "Filters", Icon: Filter },
    { href: "appearance", label: "App Appearance", Icon: Moon },
    { href: "language", label: "Language", Icon: Globe2, value: "English" }
  ] },
  { title: "Support", items: [
    { href: "help", label: "Help & FAQ", Icon: CircleHelp },
    { href: "support", label: "Contact Support", Icon: Contact },
    { href: "about", label: "About GreenChoice", Icon: Info }
  ] }
] as const;

export default async function CustomerProfilePage() {
  const session = await requireCustomerSession();
  const memberSince = new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric" }).format(new Date(session.profile.created_at));
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-7 sm:px-6"><h1 className="text-4xl font-black">Profile</h1><p className="mt-2 text-[#657168]">Manage your account and preferences.</p><Link href="/customer/profile/personal" className="mt-7 flex items-center gap-4 rounded-3xl bg-[linear-gradient(135deg,#063a25,#011c13)] p-5 text-white shadow-xl"><span className="relative grid size-24 place-items-center rounded-full border-[3px] border-lime-400 text-emerald-300"><UserRound size={48} /><span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-xl bg-emerald-500"><Camera size={18} /></span></span><span className="min-w-0 flex-1"><strong className="block truncate text-2xl">{session.profile.first_name} {session.profile.surname}</strong><span className="mt-1 block truncate text-white/72">{session.profile.email}</span><span className="mt-2 block font-bold text-emerald-300">Member since {memberSince}</span></span><ChevronRight /></Link>{groups.map((group) => <section key={group.title} className="mt-7"><h2 className="mb-3 text-lg font-black">{group.title}</h2><div className="overflow-hidden rounded-2xl border-2 border-[#dce5df] bg-white">{group.items.map(({ href, label, Icon, ...item }) => <Link key={href} href={`/customer/profile/${href}` as never} className="flex min-h-16 items-center gap-4 border-b-2 border-[#edf1ee] px-5 last:border-0"><Icon className="text-[#0a8a40]" size={23} /><span className="flex-1 font-bold">{label}</span>{"value" in item ? <span className="text-[#66736b]">{item.value}</span> : null}<ChevronRight size={20} className="text-[#657168]" /></Link>)}</div></section>)}<form action={logoutCustomerAction} className="mt-8"><button className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-red-200 bg-red-50 text-lg font-black text-red-600"><LogOut size={22} /> Log Out</button></form></main>;
}

