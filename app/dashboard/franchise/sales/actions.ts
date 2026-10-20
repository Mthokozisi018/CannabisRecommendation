"use server";

import {
  getFranchiseSalesPeriod,
  getStoreRevenuePeriod,
  getStoreDetailPeriod,
  getFranchiseHistoricalSalesRange,
} from "@/lib/franchise/data";

export async function loadFranchiseSalesPeriod(input: {
  from: string;
  to: string;
}) {
  return getFranchiseSalesPeriod(input);
}
export async function loadFranchiseHistoricalSalesRange(input: { from: string; to: string }) {
  return getFranchiseHistoricalSalesRange(input);
}
export async function loadStoreRevenuePeriod(
  storeId: string,
  input: { from: string; to: string },
) {
  return getStoreRevenuePeriod(storeId, input);
}
export async function loadStoreDetailPeriod(
  storeId: string,
  input: { from: string; to: string },
) {
  return getStoreDetailPeriod(storeId, input);
}
