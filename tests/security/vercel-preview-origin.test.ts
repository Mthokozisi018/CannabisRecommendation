import { afterEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ origin: "" }));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => name === "origin" ? request.origin : null
  })
}));

vi.mock("@/lib/rate-limit", () => ({
  requireRateLimit: vi.fn()
}));

import { verifyOrigin } from "@/lib/security";

function configureProductionOrigin() {
  vi.stubEnv("APP_URL", "https://greenchoice-workstation.vercel.app");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  vi.stubEnv("ALLOWED_ORIGINS", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  request.origin = "";
});

describe("Vercel preview request origins", () => {
  it("accepts the exact branch URL injected into a preview deployment", async () => {
    configureProductionOrigin();
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "greenchoice-workstation-unique.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "greenchoice-workstation-git-feature-team.vercel.app");
    request.origin = "https://greenchoice-workstation-git-feature-team.vercel.app";

    await expect(verifyOrigin()).resolves.toBe(true);
  });

  it("does not accept a Vercel branch URL in production", async () => {
    configureProductionOrigin();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_BRANCH_URL", "greenchoice-workstation-git-feature-team.vercel.app");
    request.origin = "https://greenchoice-workstation-git-feature-team.vercel.app";

    await expect(verifyOrigin()).rejects.toThrow("Invalid request origin.");
  });

  it("rejects preview environment values outside Vercel's HTTPS domain", async () => {
    configureProductionOrigin();
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_BRANCH_URL", "preview.vercel.app.example.com");
    request.origin = "https://greenchoice-workstation.vercel.app";

    await expect(verifyOrigin()).rejects.toThrow("Vercel preview origin configuration is invalid.");
  });
});
