import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ graceEndsAt: "" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: {
          id: "account", store_id: null, franchise_id: "franchise",
          owner_profile_id: "owner", status: "grace", onboarding_paid_at: "2026-10-01T00:00:00Z",
          grace_ends_at: state.graceEndsAt,
        }, error: null }),
      };
      return query;
    },
  }),
}));

import { billingAccessForSession } from "@/lib/billing/accounts";
import type { DashboardSession } from "@/lib/dashboard-session";

const session = {
  normalizedRole: "franchise_admin",
  profile: { role: "franchise_admin", franchise_id: "franchise" },
  staffProfileId: "owner",
  accountSetupComplete: true,
  assignedStoreId: null,
} as DashboardSession;

describe("four-day billing grace access", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("allows access before the grace deadline", async () => {
    vi.stubEnv("GREENCHOICE_ENV", "staging");
    vi.stubEnv("PAYSTACK_BILLING_ENABLED", "true");
    state.graceEndsAt = new Date(Date.now() + 86_400_000).toISOString();
    expect(await billingAccessForSession(session)).toBe("allowed");
  });
  it("restricts access after the grace deadline even before a status job runs", async () => {
    vi.stubEnv("GREENCHOICE_ENV", "staging");
    vi.stubEnv("PAYSTACK_BILLING_ENABLED", "true");
    state.graceEndsAt = new Date(Date.now() - 1_000).toISOString();
    expect(await billingAccessForSession(session)).toBe("owner_due");
    expect(await billingAccessForSession({ ...session, staffProfileId: "other" })).toBe("staff_restricted");
  });
});
