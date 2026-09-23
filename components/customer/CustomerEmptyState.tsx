import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function CustomerEmptyState({ Icon, title, message, href, action }: { Icon: LucideIcon; title: string; message: string; href?: string; action?: string }) {
  return (
    <div className="border border-[#263229] bg-[#07100b] px-5 py-12 text-center">
      <Icon className="mx-auto text-[#a8e91d]" size={42} />
      <h2 className="mt-4 text-xl font-black">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#aab4ac]">{message}</p>
      {href && action ? <Link href={href as never} className="mt-6 inline-flex h-11 items-center justify-center border border-[#9bd31f] bg-[#101d09] px-5 font-bold text-[#b5ef35]">{action}</Link> : null}
    </div>
  );
}
