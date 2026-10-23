import { beforeEach, expect, it, vi } from "vitest";
import type { DashboardSession } from "@/lib/dashboard-session";

const state = vi.hoisted(() => ({
  franchiseId: null as string | null,
  accountStatus: "active",
  paidAt: "2026-10-21T10:00:00Z" as string | null,
  welcomeAvailableAt: "2026-10-21T10:00:01Z" as string | null,
  verifiedPayment: true,
  offered: true,
  completed: false,
  accountLookupFails: false,
  offerWriteFails: false,
  accountLookupColumn: ""
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logServerEvent: vi.fn() }));
vi.mock("@/lib/billing/accounts", () => ({
  billingEnabled: () => true,
  billingDb: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: (column: string) => { if (table === "billing_accounts") state.accountLookupColumn = column; return query; },
        not: () => query,
        upsert: async () => ({ error: state.offerWriteFails ? { code: "PGRST205" } : null }),
        single: async () => ({ data: { franchise_id: state.franchiseId }, error: null }),
        maybeSingle: async () => ({
          data: table === "billing_accounts"
            ? { id: "billing", status: state.accountStatus, onboarding_paid_at: state.paidAt, welcome_available_at: state.welcomeAvailableAt }
            : table === "billing_payments" ? (state.verifiedPayment ? { id: "verified" } : null)
              : table === "manager_welcome_offers" ? (state.offered ? { profile_id: "manager" } : null)
              : (state.completed ? { profile_id: "manager" } : null),
          error: table === "billing_accounts" && state.accountLookupFails ? { code: "42703" } : null
        })
      };
      return query;
    }
  })
}));

import { managerWelcomeIsAvailable, offerManagerWelcomeAtLogin } from "@/lib/manager/welcome";
import { logServerEvent } from "@/lib/logger";

const manager = {
  isManager: true, onboardingComplete: true, onboardingCompleteSeen: true,
  assignedStoreId: "store", staffProfileId: "manager",
  profile: { created_at: "2026-10-20T10:00:00Z" }
} as DashboardSession;

beforeEach(() => {
  state.franchiseId = null;
  state.accountStatus = "active";
  state.paidAt = "2026-10-21T10:00:00Z";
  state.welcomeAvailableAt = "2026-10-21T10:00:01Z";
  state.verifiedPayment = true;
  state.offered = true;
  state.completed = false;
  state.accountLookupFails = false;
  state.offerWriteFails = false;
  state.accountLookupColumn = "";
  vi.mocked(logServerEvent).mockClear();
});

it("requires verified initial payment and an active account, not onboarding or a pending charge", async () => {
  expect(await managerWelcomeIsAvailable(manager)).toBe(true);
  state.welcomeAvailableAt = null;
  expect(await managerWelcomeIsAvailable(manager)).toBe(false);
  state.welcomeAvailableAt = "2026-10-21T10:00:01Z";
  state.verifiedPayment = false;
  expect(await managerWelcomeIsAvailable(manager)).toBe(false);
  state.verifiedPayment = true;
  state.accountStatus = "grace";
  expect(await managerWelcomeIsAvailable(manager)).toBe(false);
  state.accountStatus = "active";
  state.paidAt = null;
  expect(await managerWelcomeIsAvailable(manager)).toBe(false);
  state.paidAt = "2026-10-21T10:00:00Z";
  state.offered = false;
  expect(await managerWelcomeIsAvailable(manager)).toBe(false);
  expect(await managerWelcomeIsAvailable(manager, false)).toBe(true);
});

it("never reopens after completion and excludes roles or managers created after activation", async () => {
  state.completed = true;
  expect(await managerWelcomeIsAvailable(manager)).toBe(false);
  state.completed = false;
  expect(await managerWelcomeIsAvailable({ ...manager, isManager: false } as DashboardSession)).toBe(false);
  expect(await managerWelcomeIsAvailable({ ...manager, profile: { created_at: "2026-10-22T10:00:00Z" } } as DashboardSession)).toBe(false);
});

it("checks the parent franchise bill for franchise-store managers", async () => {
  state.franchiseId = "franchise";
  expect(await managerWelcomeIsAvailable(manager)).toBe(true);
  expect(state.accountLookupColumn).toBe("franchise_id");
});

it("does not block sign-in or the dashboard when the welcome migration is absent", async () => {
  state.accountLookupFails = true;
  await expect(offerManagerWelcomeAtLogin(manager)).resolves.toBeUndefined();
  expect(await managerWelcomeIsAvailable(manager)).toBe(false);
  expect(logServerEvent).toHaveBeenCalledWith("warn", "manager_welcome_check_unavailable", expect.any(Object));
});

it("does not block sign-in if recording a welcome offer fails", async () => {
  state.offerWriteFails = true;
  await expect(offerManagerWelcomeAtLogin(manager)).resolves.toBeUndefined();
  expect(logServerEvent).toHaveBeenCalledWith("warn", "manager_welcome_offer_unavailable", expect.any(Object));
});
