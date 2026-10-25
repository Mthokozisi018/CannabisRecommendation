import { CustomerAddresses } from "@/components/customer/CustomerAddresses";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { listCustomerAddresses } from "@/lib/customer/addresses";

export const metadata = { title: "Addresses | GreenChoice" };

export default async function CustomerAddressesPage() {
  const addresses = await listCustomerAddresses();
  return <main className="min-h-screen"><CustomerHeader notifications /><section className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><h1 className="text-3xl font-black">Addresses</h1><p className="mb-6 mt-2 text-[#aab4ac]">Save your locations and choose the address used at checkout.</p><CustomerAddresses addresses={addresses} /></section></main>;
}
