import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  franchiseId: null as string | null,
  status: "active",
  graceEnd: null as string | null,
  accountQueries: [] as string[],
  inserts: 0,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      let column = "";
      const query = {
        select: () => query,
        eq: (key: string) => { column = key; return query; },
        order: () => query,
        limit: () => query,
        insert: () => { state.inserts++; return query; },
        single: async () => ({ data: table === "stores" ? { franchise_id: state.franchiseId } : null, error: null }),
        maybeSingle: async () => {
          if (table !== "billing_accounts") return { data: null, error: null };
          state.accountQueries.push(column);
          return { data: {
            id: "one-account", store_id: state.franchiseId ? null : "store",
            franchise_id: state.franchiseId, owner_profile_id: "designated-owner",
            status: state.status, grace_ends_at: state.graceEnd,
            onboarding_paid_at: "2026-10-01T00:00:00Z",
          }, error: null };
        },
      };
      return query;
    },
  }),
}));

import { billingAccessForSession, billingAccountForSession } from "@/lib/billing/accounts";
import type { DashboardSession } from "@/lib/dashboard-session";

const receptionist = {
  normalizedRole: "employee_receptionist", profile: { role: "receptionist", franchise_id: null },
  staffProfileId: "employee", accountSetupComplete: true, assignedStoreId: "store",
} as DashboardSession;
const manager = {
  ...receptionist, normalizedRole: "manager",
  profile: { role: "manager", franchise_id: null }, staffProfileId: "store-manager",
  storeSetupComplete: true,
} as DashboardSession;

beforeEach(() => {
  vi.stubEnv("GREENCHOICE_ENV", "staging");
  vi.stubEnv("PAYSTACK_BILLING_ENABLED", "true");
  vi.stubEnv("PAYSTACK_MODE", "test");
  vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_fixture_not_a_real_key");
  state.franchiseId = null;
  state.status = "active";
  state.graceEnd = null;
  state.accountQueries = [];
  state.inserts = 0;
});

it("lets an independent-store receptionist use an active or valid-grace store without creating a bill", async () => {
  expect(await billingAccountForSession(receptionist, true)).toBeNull();
  expect(await billingAccessForSession(receptionist)).toBe("allowed");
  expect(state.accountQueries).toContain("store_id");
  state.status = "grace";
  state.graceEnd = new Date(Date.now() + 86_400_000).toISOString();
  expect(await billingAccessForSession(receptionist)).toBe("allowed");
  state.graceEnd = new Date(Date.now() - 1_000).toISOString();
  expect(await billingAccessForSession(receptionist)).toBe("staff_restricted");
  expect(state.inserts).toBe(0);
});

it("uses the parent franchise bill for franchise-store managers and receptionists", async () => {
  state.franchiseId = "franchise";
  expect(await billingAccountForSession(manager, true)).toBeNull();
  expect(await billingAccessForSession(manager)).toBe("allowed");
  expect(await billingAccessForSession(receptionist)).toBe("allowed");
  expect(state.accountQueries).toEqual(["franchise_id", "franchise_id"]);
  state.status = "restricted";
  expect(await billingAccessForSession(manager)).toBe("staff_restricted");
  expect(await billingAccessForSession(receptionist)).toBe("staff_restricted");
  expect(state.inserts).toBe(0);
});
