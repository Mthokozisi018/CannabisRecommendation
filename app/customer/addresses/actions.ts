"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addCustomerAddressAction } from "@/app/customer/actions";
import { requireCustomerSession } from "@/lib/customer/auth";
import { addressFormValues, addressRecord, customerAddressSchema } from "@/lib/customer/address-validation";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AddressActionState = { ok: boolean; message: string };

function refreshAddresses() {
  for (const path of ["/customer/addresses", "/customer/profile", "/customer/profile/addresses", "/customer/checkout", "/customer/shop"]) revalidatePath(path);
}

export async function saveCustomerAddressAction(_previous: AddressActionState, formData: FormData): Promise<AddressActionState> {
  await verifyOrigin();
  const session = await requireCustomerSession();
  const parsed = customerAddressSchema.safeParse(addressFormValues(formData));
  if (!parsed.success) return { ok: false, message: "Check every required address field and enter a four-digit postal code." };
  const id = formData.get("addressId");
  if (!id) {
    try {
      await addCustomerAddressAction(formData);
      refreshAddresses();
      return { ok: true, message: "Address added." };
    } catch {
      return { ok: false, message: "We could not save this address. Please try again." };
    }
  }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Choose a valid saved address." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Address service is unavailable." };
  const { data, error } = await supabase.from("customer_addresses").update({ ...addressRecord(parsed.data), latitude: null, longitude: null })
    .eq("id", id).eq("user_id", session.user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: "We could not update this address. Please try again." };
  refreshAddresses();
  return { ok: true, message: "Address updated." };
}

export async function deleteCustomerAddressAction(addressId: string): Promise<AddressActionState> {
  await verifyOrigin();
  const session = await requireCustomerSession();
  if (!z.string().uuid().safeParse(addressId).success) return { ok: false, message: "Choose a valid saved address." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Address service is unavailable." };
  const { data, error } = await supabase.from("customer_addresses").delete()
    .eq("id", addressId).eq("user_id", session.user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: "We could not delete this address. Please try again." };
  refreshAddresses();
  return { ok: true, message: "Address deleted." };
}

export async function setDefaultCustomerAddressAction(addressId: string): Promise<AddressActionState> {
  await verifyOrigin();
  await requireCustomerSession();
  if (!z.string().uuid().safeParse(addressId).success) return { ok: false, message: "Choose a valid saved address." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Address service is unavailable." };
  const { error } = await supabase.rpc("set_customer_default_address", { p_address_id: addressId });
  if (error) return { ok: false, message: "We could not change your default address. Please try again." };
  refreshAddresses();
  return { ok: true, message: "Default address updated." };
}
