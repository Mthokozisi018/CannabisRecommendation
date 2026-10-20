import { CustomerBottomNavigation } from "@/components/customer/CustomerBottomNavigation";

export function CustomerShell({ children }: { children: React.ReactNode }) {
  return <div className="customer-app min-h-screen overflow-x-clip pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-[#f6f8f4]">
    {children}
    <CustomerBottomNavigation />
  </div>;
}
