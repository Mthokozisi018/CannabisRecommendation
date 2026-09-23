import { CustomerCheckout } from "@/components/customer/CustomerCheckout";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { notFound, redirect } from "next/navigation";
import { requireCustomerSession } from "@/lib/customer/auth";
import { readCustomerCart } from "@/lib/customer/cart";
import { getCustomerStore } from "@/lib/customer/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Checkout | GreenChoice" };
export default async function CustomerCheckoutPage({ searchParams }: { searchParams: Promise<{ fulfillment?: string }> }) {
  const query = await searchParams;
  const session = await requireCustomerSession();
  const [cart, supabase] = await Promise.all([readCustomerCart(session.user.id), createSupabaseServerClient()]);
  if (!cart.storeId) redirect("/customer/orders");
  const [store, addressResult] = await Promise.all([
    getCustomerStore(cart.storeId),
    supabase!.from("customer_addresses").select("street_address,unit_details,suburb,city,province,postal_code").eq("user_id", session.user.id).eq("is_default", true).maybeSingle()
  ]);
  if (!store) notFound();
  if (!store.fulfillment.ordersEnabled) redirect(`/customer/stores/${store.id}`);
  const fulfillmentType = query.fulfillment === "delivery" && store.fulfillment.deliveryEnabled ? "delivery" : store.fulfillment.collectionEnabled ? "collection" : "delivery";
  if (fulfillmentType === "delivery" && !store.fulfillment.deliveryEnabled) redirect(`/customer/stores/${store.id}`);
  const address = addressResult.data;
  return <><CustomerHeader backHref="/customer/orders" backLabel="Back to current order" /><CustomerCheckout store={store} fulfillmentType={fulfillmentType} initialDetails={{ firstName: session.profile.first_name, surname: session.profile.surname, phoneNumber: session.profile.phone_number, addressLine: [address?.street_address, address?.unit_details].filter(Boolean).join(", "), suburb: address?.suburb ?? "", city: address?.city ?? "", province: address?.province ?? "", postalCode: address?.postal_code ?? "", deliveryInstructions: "", saveAddress: false }} /></>;
}

