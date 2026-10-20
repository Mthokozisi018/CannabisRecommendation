import "server-only";
import { z } from "zod";
import { requireFranchiseStore } from "./auth";
import type { LoginRecord } from "./types";

const day = z.string().refine(value => {
  if (value === "") return true;
  const parsed = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Choose a valid date.");
const filtersSchema = z.object({
  from: day.default(""),
  to: day.default(""),
  manager: z.union([z.literal(""), z.string().uuid()]).default(""),
  status: z.enum(["all", "success"]).default("all"),
  page: z.number().int().min(1).max(100000).default(1),
}).refine(value => !value.from || !value.to || value.from <= value.to, "Choose dates in order.");
export type ManagerLoginFilters = z.infer<typeof filtersSchema>;
export type ManagerLoginPage = { rows: LoginRecord[]; hasNext: boolean; filters: ManagerLoginFilters };
export const managerLoginPageSize = 25;

export async function getManagerLoginHistory(storeId: string, input: Partial<ManagerLoginFilters> = {}): Promise<ManagerLoginPage> {
  const { supabase, store } = await requireFranchiseStore(storeId);
  const filters = filtersSchema.parse(input);
  let query = supabase.from("audit_logs")
    .select("id,user_id,store_id,created_at,result,details")
    .eq("store_id", store.id)
    .eq("action", "login_success")
    .eq("details->>role", "manager");
  if (filters.manager) query = query.eq("user_id", filters.manager);
  if (filters.status !== "all") query = query.eq("result", filters.status);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00+02:00`);
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00+02:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }
  const offset = (filters.page - 1) * managerLoginPageSize;
  const { data, error } = await query.order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(offset, offset + managerLoginPageSize);
  if (error) throw new Error("Manager login history could not be loaded. Please retry.");
  const rows = (data || []) as LoginRecord[];
  return { rows: rows.slice(0, managerLoginPageSize), hasNext: rows.length > managerLoginPageSize, filters };
}
