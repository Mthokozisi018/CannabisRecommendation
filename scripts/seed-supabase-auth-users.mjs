import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function configuredAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  if (!email && !password) return null;
  if (!email || !password) throw new Error("Both ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD are required to seed the admin user.");
  return {
    email,
    password,
    fullName: "GreenChoice Administrator",
    role: "admin"
  };
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key || process.env[key]) continue;
    process.env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value || value.includes("your-") || value.includes("replace-with") || value.includes("placeholder")) {
    throw new Error(`${name} is missing or still a placeholder.`);
  }
  return value;
}

function requiredSupabaseAdminKey() {
  return process.env.SUPABASE_SECRET_KEY?.trim() || requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

async function findUserByEmail(adminClient, email) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((item) => item.email?.toLowerCase() === normalizedEmail);
    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function upsertAuthUser(adminClient, staffUser) {
  const existingUser = await findUserByEmail(adminClient, staffUser.email);
  if (existingUser) {
    const { data, error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      email: staffUser.email,
      password: staffUser.password,
      email_confirm: true,
      user_metadata: { full_name: staffUser.fullName, role: staffUser.role }
    });
    if (error) throw error;
    return { user: data.user, created: false };
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: staffUser.email,
    password: staffUser.password,
    email_confirm: true,
    user_metadata: { full_name: staffUser.fullName, role: staffUser.role }
  });
  if (error) throw error;
  return { user: data.user, created: true };
}

async function upsertStaffProfile(adminClient, staffUser, authUserId) {
  const { error } = await adminClient
    .from("staff_profiles")
    .upsert(
      {
        id: authUserId,
        auth_user_id: authUserId,
        email: staffUser.email,
        full_name: staffUser.fullName,
        role: staffUser.role,
        is_active: true
      },
      { onConflict: "auth_user_id" }
    );

  if (error) throw error;
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  if ((process.env.GREENCHOICE_ENV ?? "").toLowerCase() !== "development" ||
      process.env.ALLOW_DESTRUCTIVE_LOCAL_SEED !== "true") {
    throw new Error("Preview Auth seeding is allowed only in development with ALLOW_DESTRUCTIVE_LOCAL_SEED=true.");
  }

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredSupabaseAdminKey();

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const staffUsers = [
    {
      email: requiredEnv("DEV_MANAGER_EMAIL"),
      password: requiredEnv("DEV_MANAGER_PASSWORD"),
      fullName: "GreenChoice Manager",
      role: "manager"
    },
    {
      email: requiredEnv("DEV_RECEPTIONIST_EMAIL"),
      password: requiredEnv("DEV_RECEPTIONIST_PASSWORD"),
      fullName: "GreenChoice Receptionist",
      role: "receptionist"
    }
  ];
  const adminUser = configuredAdminUser();
  if (adminUser) staffUsers.unshift(adminUser);

  for (const staffUser of staffUsers) {
    const { user, created } = await upsertAuthUser(adminClient, staffUser);
    await upsertStaffProfile(adminClient, staffUser, user.id);
    console.log(`${created ? "Created" : "Updated"} the configured ${staffUser.role} development user.`);
  }

  console.log("Supabase Auth users and staff_profiles are ready.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
