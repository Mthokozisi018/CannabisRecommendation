import { afterEach, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/lib/environment", () => ({ assertSupabaseEnvironmentIdentity: () => true }));

import { createSupabaseRecoveryClient } from "@/lib/supabase/recovery";

afterEach(() => { vi.unstubAllEnvs(); createClient.mockClear(); });

it("starts recovery without a requesting-browser PKCE verifier or persistent server session", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  createSupabaseRecoveryClient();
  expect(createClient).toHaveBeenCalledWith("https://staging.example.supabase.co", "public-test-key", expect.objectContaining({
    auth: {
      flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false
    }
  }));
});
