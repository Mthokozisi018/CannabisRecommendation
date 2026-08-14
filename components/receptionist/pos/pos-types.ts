import type { Route } from "next";
import type { ReceptionistCategory, ReceptionistProduct } from "@/lib/receptionist/products";
import type { CheckoutInput, CheckoutResult } from "@/app/dashboard/receptionist/actions";
import type { DashboardAccountProfile } from "@/components/account/account-types";

export type ReceptionistCheckoutAction = (input: CheckoutInput) => Promise<CheckoutResult>;

export type CartItem = {
  productId: string;
  name: string;
  categoryName: string;
  subcategory: string;
  imageSrc: string;
  unitPrice: number;
  quantity: number;
  stockAvailable: number;
  sizeLabel: string | null;
};

export type POSMessage = {
  tone: "success" | "error";
  text: string;
};

export type ReceptionistPOSProps = {
  products: ReceptionistProduct[];
  categories: ReceptionistCategory[];
  unavailableReason?: string;
  initialCategory?: string;
  profileLabel: string;
  accountProfile?: DashboardAccountProfile;
  accountRole?: "manager" | "receptionist";
  isDemo?: boolean;
  storeName?: string;
  backToDashboardHref?: Route<string>;
  checkoutAction?: ReceptionistCheckoutAction;
};

export type SubcategoryOption = {
  label: string;
  value: string;
  count: number;
};

export type CultivationOption = {
  label: string;
  value: string;
  count: number;
};
