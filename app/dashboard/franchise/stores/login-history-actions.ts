"use server";
import { z } from "zod";
import { getManagerLoginHistory, type ManagerLoginFilters } from "@/lib/franchise/manager-login-history";

export async function loadManagerLoginHistory(storeId: string, filters: Partial<ManagerLoginFilters>) {
  return getManagerLoginHistory(z.string().uuid().parse(storeId), filters);
}
