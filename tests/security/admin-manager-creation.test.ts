import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  origin: vi.fn(),
  requireAdmin: vi.fn(),
  rate: vi.fn(),
  provision: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/admin/data", () => ({ requireAdminUser: vi.fn() }));
vi.mock("@/lib/security", () => ({
  verifyOrigin: mocks.origin,
  assertRateLimit: mocks.rate,
}));
vi.mock("@/lib/admin/manager-accounts", () => ({
  createManagerAccount: mocks.provision,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ reportServerException: vi.fn() }));

const fields = {
  email: "  New.Manager@Example.com ",
  temporaryPassword: "Vz!7SecureFixture",
  storeId: "forged-store",
  role: "admin",
};
async function submit(values = fields) {
  const { createManagerAccountAction } = await import(
    "@/app/dashboard/admin/actions"
  );
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  return createManagerAccountAction({ ok: false, message: "" }, form);
}
describe("Admin manager account creation boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAdmin.mockResolvedValue({ authUserId: "verified-admin" });
    mocks.provision.mockResolvedValue({ authUserId: "new-manager" });
  });
  it("normalizes email and ignores submitted role/store authority", async () => {
    const result = await submit();
    expect(result.ok).toBe(true);
    expect(mocks.provision).toHaveBeenCalledWith("verified-admin", {
      email: "new.manager@example.com",
      temporaryPassword: fields.temporaryPassword,
    });
    expect(JSON.stringify(result)).not.toContain(fields.temporaryPassword);
  });
  it.each(["origin", "requireAdmin", "rate"] as const)(
    "fails closed when %s rejects",
    async (boundary) => {
      mocks[boundary].mockRejectedValueOnce(new Error("Access denied"));
      expect((await submit()).ok).toBe(false);
      expect(mocks.provision).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...fields, email: "not-an-email" },
    { ...fields, temporaryPassword: "" },
  ])(
    "rejects invalid credentials before creating Auth records",
    async (values) => {
      expect((await submit(values)).ok).toBe(false);
      expect(mocks.provision).not.toHaveBeenCalled();
    },
  );
  it("leaves password composition requirements to the provider", async () => {
    expect((await submit({ ...fields, temporaryPassword: "abcdefgh" })).ok).toBe(true);
    expect((await submit({ ...fields, temporaryPassword: "123456" })).ok).toBe(true);
  });
  it("returns a duplicate error without echoing passwords", async () => {
    mocks.provision.mockRejectedValueOnce(
      new Error("An account already exists with this email address."),
    );
    const result = await submit();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("already exists");
    expect(result.message).not.toContain(fields.temporaryPassword);
  });
});
