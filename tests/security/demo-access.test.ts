import { beforeEach, describe, expect, it, vi } from "vitest";
import { isReadOnlyDemo } from "@/lib/demo-access";

const mocks = vi.hoisted(() => ({ demo: false, origin: "http://localhost:3001" }));
vi.mock("@/lib/demo-session", () => ({ hasReadOnlyDemoSession: async () => mocks.demo }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: mocks.origin }) }));
vi.mock("@/lib/rate-limit", () => ({ requireRateLimit: vi.fn() }));
import { verifyOrigin } from "@/lib/security";

describe("production demo authorization", () => {
  beforeEach(() => { mocks.demo = false; mocks.origin = "http://localhost:3001"; });
  it("trusts only an explicit server-controlled metadata flag", () => {
    expect(isReadOnlyDemo(null)).toBe(false);
    expect(isReadOnlyDemo({ app_metadata: {} })).toBe(false);
    expect(isReadOnlyDemo({ app_metadata: { greenchoice_demo_view_only: "true" } })).toBe(false);
    expect(isReadOnlyDemo({ app_metadata: { greenchoice_demo_view_only: true } })).toBe(true);
  });
  it("preserves normal staff operations", async () => { await expect(verifyOrigin()).resolves.toBe(true); });
  it("denies demo mutation requests", async () => {
    mocks.demo = true;
    await expect(verifyOrigin()).rejects.toThrow("view only");
  });
  it("permits explicitly read-only searches, reports and logout", async () => {
    mocks.demo = true;
    await expect(verifyOrigin({ allowDemoRead: true })).resolves.toBe(true);
  });
  it("keeps origin validation on read-only requests", async () => {
    mocks.demo = true; mocks.origin = "https://untrusted.example";
    await expect(verifyOrigin({ allowDemoRead: true })).rejects.toThrow("Invalid request origin");
  });
});
