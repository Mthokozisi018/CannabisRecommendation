import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createSupabaseFetch } from "@/lib/supabase/fetch";
import { MANUAL_MANAGER_APP_METADATA } from "@/lib/manual-manager-marker";
import { reportServerException } from "@/lib/logger";

export type ManagerAccountInput = {
  email: string;
  temporaryPassword: string;
};

/** Called after the server action verifies the administrator and request origin. */
export async function createManagerAccount(
  actorId: string,
  input: ManagerAccountInput,
) {
  const admin = createSupabaseAdminClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!admin || !url || !key) {
    throw new Error("Account creation is temporarily unavailable.");
  }

  const { data: admins, error: adminError } = await admin
    .from("staff_profiles")
    .select("auth_user_id,user_id")
    .eq("role", "admin")
    .or(
      "account_status.eq.active,and(account_status.is.null,is_active.eq.true)",
    );
  if (
    adminError ||
    admins?.length !== 1 ||
    (admins[0].auth_user_id ?? admins[0].user_id) !== actorId
  ) {
    throw new Error("Sole administrator validation failed.");
  }

  const { data: profile, error: profileError } = await admin
    .from("staff_profiles")
    .select("id")
    .eq("email", input.email)
    .limit(1);
  if (profileError) {
    throw new Error("Existing accounts could not be checked. Please retry.");
  }
  if (profile?.length) {
    throw new Error("An account already exists with this email address.");
  }

  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw new Error("Existing accounts could not be checked. Please retry.");
    }
    if (data.users.some((user) => user.email?.trim().toLowerCase() === input.email)) {
      throw new Error("An account already exists with this email address.");
    }
    if (data.users.length < 200) break;
  }

  const { data: created, error: creationError } =
    await admin.auth.admin.createUser({
      email: input.email,
      password: input.temporaryPassword,
      email_confirm: true,
      app_metadata: {
        ...MANUAL_MANAGER_APP_METADATA,
        greenchoice_created_by: actorId,
      },
    });
  if (creationError || !created.user) {
    throw new Error(
      creationError?.code === "email_exists" ||
      creationError?.code === "user_already_exists"
        ? "An account already exists with this email address."
        : creationError?.code === "weak_password"
          ? creationError.message
          : "The manager account could not be created. Check the email and password requirements and retry.",
    );
  }

  const authUserId = created.user.id;
  const manager = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: createSupabaseFetch() },
  });

  try {
    const login = await manager.auth.signInWithPassword({
      email: input.email,
      password: input.temporaryPassword,
    });
    if (login.error || login.data.user?.id !== authUserId) {
      throw new Error("Manager initialization failed.");
    }
    const initialized = await manager.rpc("bootstrap_manual_manager_profile");
    const row = Array.isArray(initialized.data)
      ? initialized.data[0]
      : initialized.data;
    if (initialized.error || !row?.profile_id) {
      throw new Error("Manager initialization failed.");
    }
  } catch {
    await manager.auth.signOut({ scope: "local" }).catch(() => undefined);
    const cleanup = await admin.auth.admin.deleteUser(authUserId);
    if (cleanup.error) {
      await admin.auth.admin.updateUserById(authUserId, {
        ban_duration: "876000h",
        app_metadata: {
          greenchoice_role: null,
          greenchoice_registration: null,
        },
      });
      await reportServerException(
        "admin_manager_creation_cleanup_failed",
        new Error("New account cleanup requires administrator review."),
        { authUserId },
      );
      throw new Error(
        "Account creation could not be completed. Administrator review is required before retrying this email.",
      );
    }
    throw new Error(
      "Account creation could not be completed. No manager account was kept; please retry.",
    );
  } finally {
    await manager.auth.signOut({ scope: "local" }).catch(() => undefined);
  }

  return { authUserId };
}
