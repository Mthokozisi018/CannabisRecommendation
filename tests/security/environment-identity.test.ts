import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { greenChoiceEnvironment } from "@/lib/environment";

describe("Vercel environment identity", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("allows staging on its designated Vercel project production target", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("GREENCHOICE_ENV", "staging");
    vi.stubEnv("VERCEL_PROJECT_ID", "prj_staging_test");
    vi.stubEnv("STAGING_VERCEL_PROJECT_ID", "prj_staging_test");
    expect(greenChoiceEnvironment()).toBe("staging");
  });

  it("rejects staging identity on any other production target", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("GREENCHOICE_ENV", "staging");
    vi.stubEnv("VERCEL_PROJECT_ID", "prj_production_test");
    vi.stubEnv("STAGING_VERCEL_PROJECT_ID", "prj_staging_test");
    expect(() => greenChoiceEnvironment()).toThrow(/designated staging project/);
  });
});
