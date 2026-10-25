import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { resolveRegistrationStore } from "@/lib/registration/store";
export const dynamic = "force-dynamic";
export const metadata = { title: "Register with your store | GreenChoice", robots: { index: false, follow: false } };

export default async function RegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let store = null;
  let temporary = false;
  try {
    store = await resolveRegistrationStore(token);
  } catch {
    temporary = true;
  }
  return store ? <RegistrationForm token={token} storeName={store.name} /> : <RegistrationUnavailable temporary={temporary} />;
}
function RegistrationUnavailable({ temporary = false }: { temporary?: boolean }) {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#f1f5f0] px-5 text-[#14251b]"><section className="w-full max-w-lg rounded-2xl border border-[#d6dfd4] bg-white p-6"><p className="font-bold text-[#087c39]">GreenChoice</p><h1 className="mt-4 text-2xl font-black">{temporary ? "Registration temporarily unavailable" : "Registration link unavailable"}</h1><p className="mt-3 leading-6">{temporary ? "Please try again later or ask the store for assistance." : "This link is invalid or no longer active. Please ask the store for its current registration QR code."}</p></section></main>;
}
