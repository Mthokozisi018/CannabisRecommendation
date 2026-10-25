import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  profile: null as { email: string; status: string } | null,
  send: vi.fn(),
  query: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/app-url", () => ({ configuredApplicationUrl: () => "http://127.0.0.1:3001" }));
vi.mock("@/lib/security", () => ({ verifyOrigin: async () => true }));
vi.mock("@/lib/rate-limit", () => ({ requireRateLimit: async () => {}, trustedClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/supabase/recovery", () => ({ createSupabaseRecoveryClient: () => ({ auth: { resetPasswordForEmail: state.send } }) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: () => ({ from: state.query }) }));

import { POST } from "@/app/api/auth/customer-recover-account/route";

function validId() {
  const prefix = "900101500908";
  for (let digit = 0; digit < 10; digit++) {
    const candidate = prefix + digit;
    let sum = 0;
    for (let index = candidate.length - 1, doubled = false; index >= 0; index--, doubled = !doubled) {
      let value = Number(candidate[index]) * (doubled ? 2 : 1);
      if (value > 9) value -= 9;
      sum += value;
    }
    if (sum % 10 === 0) return candidate;
  }
  throw Error("Could not create a valid fixture ID");
}

function request() {
  return new Request("http://127.0.0.1:3001/api/auth/customer-recover-account", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: "082 123 4567", southAfricanId: validId() })
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.profile = { email: "customer@example.test", status: "active" };
  state.send.mockResolvedValue({ error: null });
  state.query.mockImplementation(() => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: state.profile }) };
    return chain;
  });
});

it("sends a customer recovery link to the common password form", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(state.send).toHaveBeenCalledWith("customer@example.test", {
    redirectTo: "http://127.0.0.1:3001/update-password?flow=recovery"
  });
});

it.each([null, { email: "deleted@example.test", status: "deleted" }])("does not send a link for missing or deleted customer profiles", async (profile) => {
  state.profile = profile;
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(state.send).not.toHaveBeenCalled();
  expect((await response.json()).message).toMatch(/If those details match|secure recovery link/);
});
