import Link from "next/link";
import { Bell, ChevronRight, Clock3 } from "lucide-react";
import type { CustomerAlert } from "@/lib/customer/alert-model";

const date = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" });

export function CustomerAlertItem({ alert }: { alert: CustomerAlert }) {
  const Icon = alert.type === "collection_reminder" ? Clock3 : Bell;
  return <article className={`rounded-md border bg-[#08100b] ${alert.urgent ? "border-[#86b724]" : "border-[#2d3931]"}`}><Link href={alert.href as never} className="flex min-h-24 items-center gap-3 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a8e91d] sm:p-5"><Icon className="shrink-0 text-[#a8e91d]" size={23} /><div className="min-w-0 flex-1"><h2 className="font-black">{alert.title}</h2><p className="mt-1 break-words text-sm text-[#aab4ac]">{alert.message}</p><p className="mt-2 text-xs text-[#aab4ac]">{alert.timeLabel ? `${alert.timeLabel}: ` : ""}<time dateTime={alert.occurredAt}>{date.format(new Date(alert.occurredAt))}</time></p></div><ChevronRight className="shrink-0 text-[#a8e91d]" size={19} /></Link></article>;
}
