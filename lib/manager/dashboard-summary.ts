import "server-only";
import { cache } from "react";
import { cacheGet, cacheSet, GREENCHOICE_CACHE_TTLS_SECONDS, managerDashboardSummaryCacheKey } from "@/lib/cache/redis";
import type { DashboardSession } from "@/lib/dashboard-session";
import { logServerEvent } from "@/lib/logger";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const STORE_TIME_ZONE = "Africa/Johannesburg";

type StoreStaffRow = {
  id: string;
  auth_user_id: string | null;
  user_id: string | null;
  full_name: string | null;
  first_name: string | null;
  surname: string | null;
  role: "manager" | "receptionist" | "admin";
  account_status: string | null;
  is_active: boolean | null;
};

export type LoggedInStaffSummary = {
  id: string;
  name: string;
  initials: string;
  role: "manager" | "receptionist";
  signedInAt: string;
};

export type ManagerDashboardSummary = {
  totalSalesToday: number;
  loggedInToday: LoggedInStaffSummary[];
};

function datePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second")
  };
}

function zonedDateTimeToUtc(parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number }, timeZone: string) {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0));
  const formatted = datePartsInTimeZone(utcGuess, timeZone);
  const formattedAsUtc = Date.UTC(formatted.year, formatted.month - 1, formatted.day, formatted.hour, formatted.minute, formatted.second);
  return new Date(utcGuess.getTime() - (formattedAsUtc - utcGuess.getTime()));
}

function todayBounds(timeZone = STORE_TIME_ZONE) {
  const today = datePartsInTimeZone(new Date(), timeZone);
  const start = zonedDateTimeToUtc({ year: today.year, month: today.month, day: today.day }, timeZone);
  const end = zonedDateTimeToUtc({ year: today.year, month: today.month, day: today.day + 1 }, timeZone);
  return { start, end };
}

function staffIsActive(staff: StoreStaffRow) {
  return staff.account_status ? staff.account_status === "active" : staff.is_active === true;
}

function staffName(staff: StoreStaffRow) {
  return staff.full_name?.trim() || [staff.first_name, staff.surname].map((value) => value?.trim()).filter(Boolean).join(" ") || "Staff";
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "ST";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

export const getManagerDashboardSummary = cache(async (session: DashboardSession): Promise<ManagerDashboardSummary> => {
  const storeId = session.assignedStoreId;
  if (!storeId) return { totalSalesToday: 0, loggedInToday: [] };

  const cacheKey = managerDashboardSummaryCacheKey(storeId);
  const cached = await cacheGet<ManagerDashboardSummary>(cacheKey);
  if (cached) return cached;

  const admin = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();
  if (!admin || !supabase) return { totalSalesToday: 0, loggedInToday: [] };

  const { start, end } = todayBounds();
  const [salesResult, staffResult, loginResult] = await Promise.all([
    supabase.rpc("get_manager_sales_total_today"),
    admin
      .from("staff_profiles")
      .select("id, auth_user_id, user_id, full_name, first_name, surname, role, account_status, is_active")
      .eq("store_id", storeId)
      .in("role", ["manager", "receptionist"]),
    admin
      .from("audit_logs")
      .select("user_id, created_at")
      .eq("store_id", storeId)
      .eq("action", "login_success")
      .eq("result", "success")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: true })
  ]);

  if (salesResult.error || staffResult.error || loginResult.error) {
    await logServerEvent("warn", "manager_dashboard_summary_partial", {
      salesAvailable: !salesResult.error,
      staffAvailable: !staffResult.error,
      loginSummaryAvailable: !loginResult.error
    });
  }

  const salesRow = Array.isArray(salesResult.data) ? salesResult.data[0] : salesResult.data;
  const parsedSalesTotal = Number(salesRow?.total_sales ?? 0);
  const totalSalesToday = Number.isFinite(parsedSalesTotal) ? parsedSalesTotal : 0;
  const staff = ((staffResult.data ?? []) as StoreStaffRow[]).filter(staffIsActive);
  const staffByAuthId = new Map<string, StoreStaffRow>();
  staff.forEach((member) => {
    const authUserId = member.user_id ?? member.auth_user_id;
    if (authUserId && !staffByAuthId.has(authUserId)) staffByAuthId.set(authUserId, member);
  });

  const sessionsByUser = new Map<string, string>();
  for (const login of loginResult.data ?? []) {
    const authUserId = typeof login.user_id === "string" ? login.user_id : "";
    const signedInAt = typeof login.created_at === "string" ? login.created_at : "";
    if (authUserId && signedInAt && staffByAuthId.has(authUserId) && !sessionsByUser.has(authUserId)) {
      sessionsByUser.set(authUserId, signedInAt);
    }
  }

  const loggedInToday = Array.from(staffByAuthId.entries())
    .filter(([authUserId]) => sessionsByUser.has(authUserId))
    .map(([authUserId, member]) => {
      const name = staffName(member);
      const role: LoggedInStaffSummary["role"] = member.role === "manager" ? "manager" : "receptionist";
      return { id: authUserId, name, initials: initials(name), role, signedInAt: sessionsByUser.get(authUserId) ?? "" };
    })
    .sort((a, b) => a.signedInAt.localeCompare(b.signedInAt) || a.name.localeCompare(b.name));

  const summary = { totalSalesToday, loggedInToday };
  await cacheSet(cacheKey, summary, GREENCHOICE_CACHE_TTLS_SECONDS.managerDashboardSummary);
  return summary;
});
