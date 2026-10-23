"use client";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
export function PublicTelemetry() {
  const pathname = usePathname();
  if (pathname.startsWith("/register") || pathname.startsWith("/registration-complete") || pathname.startsWith("/legal/")) return null;
  return <><Analytics beforeSend={event => event.url.includes("/register") || event.url.includes("/api/registration/") ? null : event} /><SpeedInsights /></>;
}
