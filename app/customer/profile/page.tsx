import Link from "next/link";
import { Bell, ChevronRight, CircleHelp, LockKeyhole, LogOut, Mail, MapPin, Pencil, Phone, ShieldCheck, UserRound } from "lucide-react";
import { logoutCustomerAction } from "@/app/customer/actions";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { requireCustomerSession } from "@/lib/customer/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const rows = [
  { href: "personal", label: "Personal information", detail: "Update your name and phone number.", Icon: UserRound },
  { href: "privacy", label: "Password & privacy", detail: "Account recovery and privacy documents.", Icon: LockKeyhole },
  { href: "notifications", label: "Notifications", detail: "Manage account update preferences.", Icon: Bell },
  { href: "help", label: "Help & support", detail: "Answers and customer support.", Icon: CircleHelp }
] as const;

export default async function CustomerProfilePage() {
  const session = await requireCustomerSession();
  const supabase = await createSupabaseServerClient();
  const { data: addresses } = await supabase!.from("customer_addresses").select("id,label,street_address,unit_details,suburb,city,province,postal_code,is_default").eq("user_id", session.user.id).order("is_default", { ascending: false });
  const defaultAddress = addresses?.[0] ?? null;
  return (
    <main className="min-h-screen">
      <CustomerHeader />
      <section className="border-y border-[#253029] bg-[#08110b]"><div className="mx-auto max-w-4xl px-4 py-7 sm:px-6"><h1 className="text-3xl font-black sm:text-4xl">Profile</h1><p className="mt-2 text-[#a7b1a9]">Manage your account, addresses, and preferences.</p></div></section>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <section className="flex flex-col gap-4 border border-[#2d3931] bg-[#08100b] p-5 sm:flex-row sm:items-center"><span className="grid size-20 shrink-0 place-items-center rounded-full border border-[#8dbe28] bg-[#111d0a] text-[#a8e91d]"><UserRound size={38} /></span><div className="min-w-0 flex-1"><h2 className="truncate text-2xl font-black">{session.profile.first_name} {session.profile.surname}</h2><p className="mt-2 flex items-center gap-2 truncate text-sm text-[#b1bbb3]"><Phone size={15} className="text-[#a8e91d]" />{session.profile.phone_number}</p><p className="mt-2 flex items-center gap-2 truncate text-sm text-[#b1bbb3]"><Mail size={15} className="text-[#a8e91d]" />{session.profile.email}</p></div><Link href="/customer/profile/personal" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 border border-[#86b724] px-4 font-bold text-[#a8e91d]"><Pencil size={17} />Edit profile</Link></section>

        <section className="mt-6"><h2 className="mb-3 text-lg font-black">Account</h2><div className="divide-y divide-[#28342c] border border-[#2d3931] bg-[#08100b]">{rows.map(({ href, label, detail, Icon }) => <Link key={href} href={`/customer/profile/${href}`} className="flex min-h-20 items-center gap-4 px-4"><span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#567321] text-[#a8e91d]"><Icon size={19} /></span><span className="min-w-0 flex-1"><strong className="block">{label}</strong><span className="mt-1 block text-sm text-[#98a49b]">{detail}</span></span><ChevronRight size={19} /></Link>)}</div></section>

        <section className="mt-6"><div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-lg font-black">My Addresses</h2><Link href="/customer/addresses" className="text-sm font-bold text-[#a8e91d]">Manage</Link></div><Link href="/customer/addresses" className="flex min-h-24 items-center gap-4 border border-[#2d3931] bg-[#08100b] p-4"><span className="grid size-11 shrink-0 place-items-center rounded-full border border-[#567321] text-[#a8e91d]"><MapPin size={21} /></span><span className="min-w-0 flex-1">{defaultAddress ? <><strong className="block">{defaultAddress.label}{defaultAddress.is_default ? " · Default" : ""}</strong><span className="mt-1 block text-sm leading-5 text-[#a5afa7]">{[defaultAddress.street_address, defaultAddress.unit_details, defaultAddress.suburb, defaultAddress.city, defaultAddress.province, defaultAddress.postal_code].filter(Boolean).join(", ")}</span></> : <><strong className="block">Add an address</strong><span className="mt-1 block text-sm text-[#a5afa7]">Save a delivery location.</span></>} </span><ChevronRight size={19} /></Link></section>

        <section className="mt-6 border border-[#2d3931] bg-[#08100b] p-4"><div className="flex items-start gap-3"><ShieldCheck className="shrink-0 text-[#a8e91d]" /><div><h2 className="font-black">Verified customer account</h2><p className="mt-1 text-sm leading-5 text-[#9da89f]">Your identity and account privacy controls remain protected by the existing GreenChoice verification flow.</p></div></div></section>
        <form action={logoutCustomerAction} className="mt-6"><button className="inline-flex h-12 w-full items-center justify-center gap-2 border border-[#773934] bg-[#21100e] font-bold text-[#ff958d]"><LogOut size={19} />Log Out</button></form>
      </div>
    </main>
  );
}
