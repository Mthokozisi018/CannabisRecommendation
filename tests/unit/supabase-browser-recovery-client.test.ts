import { expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@supabase/ssr", () => ({ createBrowserClient: vi.fn() }));

import { createSupabaseImplicitRecoveryClient } from "@/lib/supabase/client";

it("uses a temporary in-memory implicit client for emailed recovery fragments", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://isolated.example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  createSupabaseImplicitRecoveryClient();
  expect(createClient).toHaveBeenCalledWith("https://isolated.example.supabase.co", "public-test-key", {
    auth: {
      flowType: "implicit", storageKey: "greenchoice-recovery-temporary",
      persistSession: false, autoRefreshToken: false, detectSessionInUrl: true
    }
  });
  vi.unstubAllEnvs();
});
