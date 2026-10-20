import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireStore: vi.fn(),
  mutation: vi.fn(),
  reauth: vi.fn(),
  createAuth: vi.fn(),
  cleanup: vi.fn(),
  origin: vi.fn(),
  reset: vi.fn(),
  password: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/franchise/auth", () => ({
  requireFranchiseAdmin: mocks.requireAdmin,
  requireFranchiseStore: mocks.requireStore,
}));
vi.mock("@/lib/franchise/mutations", () => ({
  franchiseMutation: mocks.mutation,
  verifyFranchiseSensitiveAction: mocks.reauth,
  createFranchiseAuthAccount: mocks.createAuth,
  cleanupUnboundFranchiseAuthAccount: mocks.cleanup,
  franchiseServiceClient: vi.fn(),
}));
vi.mock("@/lib/security", () => ({
  verifyOrigin: mocks.origin,
  assertRateLimit: mocks.rate,
}));
vi.mock("@/lib/cache/redis", () => ({ invalidateManagerStaffCache: vi.fn() }));
vi.mock("@/lib/staff-password-reset", () => ({
  sendStaffPasswordResetLink: mocks.reset,
}));
vi.mock("@/lib/manager/onboarding", () => ({
  normalizeSAPhone: (s: string) => s,
  slugForStoreName: () => "new-store",
}));
const storeId = "30000000-0000-4000-8000-000000000001";
const makeForm = (values: Record<string, string>) => {
  const form = new FormData();
  Object.entries(values).forEach(([k, v]) => form.set(k, v));
  return form;
};
const store = {
  idempotencyKey: "50000000-0000-4000-8000-000000000001",
  name: "Real Store",
  email: "store@example.com",
  phone: "0821234567",
  address: "123 Test Road",
  city: "Test City",
  province: "Gauteng",
  postalCode: "2000",
};
const person = {
  storeId,
  role: "manager",
  email: "manager@example.com",
  firstName: "Test",
  surname: "Person",
  phone: "0821234567",
  password: "Secure!7QzExample",
  confirmPassword: "Secure!7QzExample",
  actorPassword: "secret-confirmation",
};
describe("Franchise server action boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.origin.mockResolvedValue(true);
    mocks.requireAdmin.mockResolvedValue({
      session: { authUserId: "trusted-actor" },
    });
    mocks.requireStore.mockResolvedValue({
      session: { authUserId: "trusted-actor" },
      store: { id: storeId, franchise_id: "trusted-franchise" },
    });
    mocks.mutation.mockResolvedValue(storeId);
    mocks.createAuth.mockResolvedValue("new-auth-user");
    mocks.reauth.mockResolvedValue(undefined);
  });
  it("ignores browser-supplied franchise and actor identifiers when creating a store", async () => {
    const { saveFranchiseStoreAction } = await import(
      "@/app/dashboard/franchise/actions"
    );
    const result = await saveFranchiseStoreAction(
      { ok: false, message: "" },
      makeForm({ ...store, franchiseId: "forged", actorId: "forged" }),
    );
    expect(result.ok).toBe(true);
    expect(mocks.mutation).toHaveBeenCalledWith(
      "trusted-actor",
      "create_store",
      expect.not.objectContaining({ franchiseId: expect.anything() }),
    );
  });
  it("denies cross-franchise store edits before writing", async () => {
    mocks.requireStore.mockRejectedValueOnce(
      new Error("Store not found in your franchise."),
    );
    const { saveFranchiseStoreAction } = await import(
      "@/app/dashboard/franchise/actions"
    );
    expect(
      (
        await saveFranchiseStoreAction(
          { ok: false, message: "" },
          makeForm({ ...store, storeId, active: "true" }),
        )
      ).ok,
    ).toBe(false);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
  it("denies incomplete setup before creating a store", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("Setup required"));
    const { saveFranchiseStoreAction } = await import(
      "@/app/dashboard/franchise/actions"
    );
    expect(
      (
        await saveFranchiseStoreAction(
          { ok: false, message: "" },
          makeForm(store),
        )
      ).ok,
    ).toBe(false);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
  it("disallows elevated roles and requires authenticated store access without asking for the actor password", async () => {
    const { createFranchiseStaffAction } = await import("@/app/dashboard/franchise/actions");
    expect((await createFranchiseStaffAction({ ok: false, message: "" }, makeForm({ ...person, role: "admin" }))).ok).toBe(false);
    expect(mocks.createAuth).not.toHaveBeenCalled();
    mocks.requireStore.mockRejectedValueOnce(new Error("Store not found in your franchise."));
    expect((await createFranchiseStaffAction({ ok: false, message: "" }, makeForm(person))).ok).toBe(false);
    expect(mocks.createAuth).not.toHaveBeenCalled();
    const result = await createFranchiseStaffAction({ ok: false, message: "" }, makeForm({storeId, role:"manager", email:person.email, password:person.password}));
    expect(result.ok).toBe(true);
    expect(mocks.reauth).not.toHaveBeenCalled();
    expect(mocks.rate).toHaveBeenCalledWith("franchise:staff-create:trusted-actor",20,3600000);
  });
  it("assigns only the selected authorized store and franchise and discards submitted personal details", async () => {
    const { createFranchiseStaffAction } = await import("@/app/dashboard/franchise/actions");
    expect((await createFranchiseStaffAction({ok:false,message:""},makeForm({...person,franchiseId:"forged",actorId:"forged"}))).ok).toBe(true);
    expect(mocks.createAuth).toHaveBeenCalledWith("trusted-actor","manager",{role:"manager",email:person.email,password:person.password},{storeId,franchiseId:"trusted-franchise"});
    expect(mocks.mutation).toHaveBeenCalledWith("trusted-actor","create_staff",{authUserId:"new-auth-user",storeId,role:"manager"});
  });
  it("allows provider-approved simple receptionist temporary passwords while preserving manager password policy", async () => {
    const { createFranchiseStaffAction } = await import("@/app/dashboard/franchise/actions");
    expect((await createFranchiseStaffAction({ok:false,message:""},makeForm({storeId,role:"receptionist",email:"Reception@Example.com",password:"abcdefgh"}))).ok).toBe(true);
    expect(mocks.createAuth).toHaveBeenCalledWith("trusted-actor","receptionist",{role:"receptionist",email:"reception@example.com",password:"abcdefgh"},{storeId,franchiseId:"trusted-franchise"});
    mocks.createAuth.mockClear();
    expect((await createFranchiseStaffAction({ok:false,message:""},makeForm({storeId,role:"manager",email:person.email,password:"abcdefgh"}))).ok).toBe(false);
    expect(mocks.createAuth).not.toHaveBeenCalled();
  });
  it("fails closed on rate limits and respects provider password failures", async () => {
    const { createFranchiseStaffAction } = await import("@/app/dashboard/franchise/actions");
    mocks.rate.mockRejectedValueOnce(new Error("Too many requests"));
    expect((await createFranchiseStaffAction({ok:false,message:""},makeForm(person))).ok).toBe(false);
    expect(mocks.createAuth).not.toHaveBeenCalled();
    mocks.createAuth.mockRejectedValueOnce(new Error("The authentication provider requires a longer password."));
    const result=await createFranchiseStaffAction({ok:false,message:""},makeForm({storeId,role:"receptionist",email:person.email,password:"abc"}));
    expect(result.ok).toBe(false);
    expect(result.message).toContain("provider requires");
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
  it("does not pass temporary credentials to audit/database mutations or return them", async () => {
    const { createFranchiseStaffAction } = await import(
      "@/app/dashboard/franchise/actions"
    );
    const result = await createFranchiseStaffAction(
      { ok: false, message: "" },
      makeForm(person),
    );
    expect(result.ok).toBe(true);
    expect(JSON.stringify(mocks.mutation.mock.calls)).not.toContain(
      person.password,
    );
    expect(JSON.stringify(result)).not.toContain(person.password);
  });
  it("cleans up only a newly created unbound Auth account if the database quota rejects it", async () => {
    mocks.mutation.mockRejectedValueOnce(
      new Error("manager limit reached (3)"),
    );
    const { createFranchiseStaffAction } = await import(
      "@/app/dashboard/franchise/actions"
    );
    const result = await createFranchiseStaffAction(
      { ok: false, message: "" },
      makeForm(person),
    );
    expect(result.ok).toBe(false);
    expect(mocks.cleanup).toHaveBeenCalledWith("new-auth-user");
  });
  it("rejects forged origins before resolving an account", async () => {
    mocks.origin.mockRejectedValueOnce(new Error("Invalid request origin."));
    const { saveFranchiseStoreAction } = await import(
      "@/app/dashboard/franchise/actions"
    );
    expect(
      (
        await saveFranchiseStoreAction(
          { ok: false, message: "" },
          makeForm(store),
        )
      ).ok,
    ).toBe(false);
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
  });
});
