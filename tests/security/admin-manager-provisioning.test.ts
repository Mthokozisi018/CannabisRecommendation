import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  client: vi.fn(),
  log: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: mocks.admin,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/fetch", () => ({ createSupabaseFetch: () => fetch }));
vi.mock("@/lib/logger", () => ({ reportServerException: mocks.log }));

import { createManagerAccount } from "@/lib/admin/manager-accounts";

const input = {
  email: "new@example.com",
  temporaryPassword: "provider-approved-password",
};
const identity = { id: "new-auth-id", email: input.email };
const adminApi = {
  listUsers: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  updateUserById: vi.fn(),
};
const manager = {
  auth: { signInWithPassword: vi.fn(), signOut: vi.fn() },
  rpc: vi.fn(),
};
const query = { select: vi.fn(), eq: vi.fn(), or: vi.fn(), limit: vi.fn() };

describe("Manager Auth provisioning and compensation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fixture-public-key");
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.or.mockResolvedValue({
      data: [{ auth_user_id: "admin-id" }],
      error: null,
    });
    query.limit.mockResolvedValue({ data: [], error: null });
    mocks.admin.mockReturnValue({
      from: () => query,
      auth: { admin: adminApi },
    });
    mocks.client.mockReturnValue(manager);
    adminApi.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    adminApi.createUser.mockResolvedValue({
      data: { user: identity },
      error: null,
    });
    adminApi.deleteUser.mockResolvedValue({ error: null });
    adminApi.updateUserById.mockResolvedValue({ error: null });
    manager.auth.signInWithPassword.mockResolvedValue({
      data: { user: identity },
      error: null,
    });
    manager.rpc.mockResolvedValue({
      data: [{ profile_id: "profile-id", initialized: true }],
      error: null,
    });
    manager.auth.signOut.mockResolvedValue({ error: null });
  });

  it("creates an active manager identity and a storeless onboarding profile", async () => {
    expect(await createManagerAccount("admin-id", input)).toEqual({
      authUserId: identity.id,
    });
    expect(adminApi.createUser).toHaveBeenCalledWith({
      email: input.email,
      password: input.temporaryPassword,
      email_confirm: true,
      app_metadata: {
        greenchoice_role: "manager",
        greenchoice_registration: "manual",
        greenchoice_created_by: "admin-id",
      },
    });
    expect(manager.rpc).toHaveBeenCalledWith(
      "bootstrap_manual_manager_profile",
    );
    expect(mocks.client).toHaveBeenCalledWith(
      expect.any(String),
      "fixture-public-key",
      expect.objectContaining({
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
    );
    expect(manager.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(adminApi.deleteUser).not.toHaveBeenCalled();
    expect(adminApi.updateUserById).not.toHaveBeenCalled();
  });

  it("rejects a non-admin actor before any Auth operation", async () => {
    await expect(
      createManagerAccount("franchise-admin-id", input),
    ).rejects.toThrow("Sole administrator");
    expect(adminApi.createUser).not.toHaveBeenCalled();
  });

  it("never converts or resets an existing Auth-only account", async () => {
    adminApi.listUsers.mockResolvedValue({
      data: { users: [{ id: "existing", email: "NEW@example.com" }] },
      error: null,
    });
    await expect(createManagerAccount("admin-id", input)).rejects.toThrow(
      "already exists",
    );
    expect(adminApi.createUser).not.toHaveBeenCalled();
    expect(adminApi.updateUserById).not.toHaveBeenCalled();
  });

  it("checks duplicates beyond the first Auth page", async () => {
    adminApi.listUsers
      .mockResolvedValueOnce({
        data: {
          users: Array.from({ length: 200 }, (_, index) => ({
            email: `other-${index}@example.com`,
          })),
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { users: [identity] }, error: null });
    await expect(createManagerAccount("admin-id", input)).rejects.toThrow(
      "already exists",
    );
    expect(adminApi.listUsers).toHaveBeenLastCalledWith({
      page: 2,
      perPage: 200,
    });
    expect(adminApi.createUser).not.toHaveBeenCalled();
  });

  it("handles simultaneous duplicate creation without deleting the winning identity", async () => {
    adminApi.createUser.mockResolvedValue({
      data: { user: null },
      error: { code: "email_exists" },
    });
    await expect(createManagerAccount("admin-id", input)).rejects.toThrow(
      "already exists",
    );
    expect(adminApi.deleteUser).not.toHaveBeenCalled();
  });

  it.each(["login", "bootstrap"])(
    "rolls back only its new Auth identity when %s fails",
    async (stage) => {
      if (stage === "login") {
        manager.auth.signInWithPassword.mockResolvedValue({
          data: {},
          error: { message: "failure" },
        });
      } else {
        manager.rpc.mockResolvedValue({
          data: null,
          error: { message: "failure" },
        });
      }
      await expect(createManagerAccount("admin-id", input)).rejects.toThrow(
        "No manager account was kept",
      );
      expect(adminApi.deleteUser).toHaveBeenCalledExactlyOnceWith(identity.id);
    },
  );

  it("quarantines its new identity and reports required review when deletion fails", async () => {
    manager.rpc.mockResolvedValue({
      data: null,
      error: { message: "failure" },
    });
    adminApi.deleteUser.mockResolvedValue({
      error: { message: "unavailable" },
    });
    await expect(createManagerAccount("admin-id", input)).rejects.toThrow(
      "Administrator review",
    );
    expect(adminApi.updateUserById).toHaveBeenCalledWith(
      identity.id,
      expect.objectContaining({ ban_duration: "876000h" }),
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(
      input.temporaryPassword,
    );
  });
});
