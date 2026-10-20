import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicTelemetry } from "@/components/PublicTelemetry";
import "./globals.css";
import { NavigationLoadingOverlay } from "@/components/NavigationLoadingOverlay";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "GreenChoice Dispensary Workstation",
  description: "Staff-assisted effect-first cannabis recommendation workstation."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopBar />
        {children}
        <Suspense fallback={null}>
          <NavigationLoadingOverlay />
        </Suspense>
        <Suspense fallback={null}><PublicTelemetry /></Suspense>
      </body>
    </html>
  );
}
