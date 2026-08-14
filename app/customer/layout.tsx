import { headers } from "next/headers";
import { CustomerCartProvider } from "@/components/customer/CustomerCartProvider";
import { CustomerShell } from "@/components/customer/CustomerShell";
import { requireCustomerSession } from "@/lib/customer/auth";
import { readCustomerCart } from "@/lib/customer/cart";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-greenchoice-pathname") ?? "";
  const publicCustomerRoute = pathname === "/customer/register" || pathname === "/customer/verify-email" || pathname === "/customer/account-unavailable";
  if (publicCustomerRoute) return children;
  const session = await requireCustomerSession();
  const cart = await readCustomerCart(session.user.id);
  return <CustomerCartProvider initialCart={cart}><CustomerShell>{children}</CustomerShell></CustomerCartProvider>;
}

