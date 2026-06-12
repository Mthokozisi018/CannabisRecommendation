import type { Metadata } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { TopBarVisibility } from "@/components/TopBarVisibility";

export const metadata: Metadata = {
  title: "GreenChoice Dispensary Workstation",
  description: "Staff-assisted effect-first cannabis recommendation workstation."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopBarVisibility>
          <TopBar />
        </TopBarVisibility>
        {children}
      </body>
    </html>
  );
}
