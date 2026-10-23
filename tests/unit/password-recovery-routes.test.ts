import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  send: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  session: null as object | null, getSession: vi.fn(), access: { allowed: true, reason: "" }, audit: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/app-url", () => ({ configuredApplicationUrl: () => "http://127.0.0.1:3001" }));
vi.mock("@/lib/security", () => ({ verifyOrigin: async () => true, RequestOriginError: class extends Error {} }));
vi.mock("@/lib/supabase/recovery", () => ({ createSupabaseRecoveryClient: () => ({ auth: {
  resetPasswordForEmail: state.send,
} }) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: {
  getUser: state.getUser,
  updateUser: state.updateUser,
  signOut: state.signOut
} }) }));
vi.mock("@/lib/dashboard-session", () => ({
  getDashboardSession: state.getSession,
  decideDashboardAccess: () => state.access,
  auditAccessDenied: state.audit
}));

import { POST as requestReset } from "@/app/api/auth/password-recovery/route";
import { POST as updatePassword } from "@/app/api/auth/password-update/route";

beforeEach(() => {
  vi.clearAllMocks();
  state.send.mockResolvedValue({ error: null });
  state.getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
  state.updateUser.mockResolvedValue({ error: null });
  state.signOut.mockResolvedValue({ error: null });
  state.session = null;
  state.getSession.mockImplementation(async () => state.session);
  state.access = { allowed: true, reason: "" };
});

function post(path: string, body: object) {
  return new Request(`http://127.0.0.1:3001${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
}

it("initiates recovery with a local callback while keeping the response account-neutral", async () => {
  const response = await requestReset(post("/api/auth/password-recovery", { email: "person@example.com" }));
  expect(response.status).toBe(200);
  expect(state.send).toHaveBeenCalledWith("person@example.com", {
    redirectTo: "http://127.0.0.1:3001/update-password?flow=recovery"
  });
  expect((await response.json()).message).toMatch(/If an account exists/);
});

it("rejects an update without a verified Supabase user", async () => {
  state.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const response = await updatePassword(post("/api/auth/password-update", {
    password: "RiverCedar84!Bright", confirmPassword: "RiverCedar84!Bright"
  }));
  expect(response.status).toBe(401);
  expect(state.updateUser).not.toHaveBeenCalled();
});

it("rejects mismatched passwords before updating Supabase", async () => {
  const response = await updatePassword(post("/api/auth/password-update", {
    password: "RiverCedar84!Bright", confirmPassword: "DifferentRiver84!Bright"
  }));
  expect(response.status).toBe(400);
  expect(state.updateUser).not.toHaveBeenCalled();
});

it("updates a restricted user's password without changing access and signs out locally", async () => {
  state.session = { profile: { role: "employee_receptionist", account_status: "restricted" } };
  state.access = { allowed: false, reason: "restricted_account" };
  const response = await updatePassword(post("/api/auth/password-update", {
    password: "RiverCedar84!Bright", confirmPassword: "RiverCedar84!Bright"
  }));
  expect(response.status).toBe(200);
  expect(state.updateUser).toHaveBeenCalledWith({ password: "RiverCedar84!Bright" });
  expect(state.audit).toHaveBeenCalledWith(state.session, "password_reset_completed_restricted_account", "restricted_account");
  expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect((await response.json()).redirectTo).toBe("/login");
});

it.each([
  ["platform administrator", "admin"],
  ["franchise administrator", "franchise_admin"],
  ["store manager", "manager"],
  ["receptionist", "receptionist"],
  ["customer", null]
])("resets a %s password without changing their role or sending them to billing", async (_label, role) => {
  state.session = role ? { profile: { role, account_status: "active" } } : null;
  const response = await updatePassword(post("/api/auth/password-update", {
    password: "RiverCedar84!Bright", confirmPassword: "RiverCedar84!Bright"
  }));
  expect(response.status).toBe(200);
  expect(state.updateUser).toHaveBeenCalledExactlyOnceWith({ password: "RiverCedar84!Bright" });
  expect(state.session).toEqual(role ? { profile: { role, account_status: "active" } } : null);
  expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect((await response.json()).redirectTo).toBe("/login");
});

it("reports success when the optional staff profile lookup fails after Auth updates the password", async () => {
  state.getSession.mockRejectedValueOnce(new Error("profile database unavailable"));
  const response = await updatePassword(post("/api/auth/password-update", {
    password: "RiverCedar84!Bright", confirmPassword: "RiverCedar84!Bright"
  }));
  expect(response.status).toBe(200);
  expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
});
