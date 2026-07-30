import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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
  if (!value || value.includes("replace-with") || value.includes("placeholder")) {
    throw new Error(`${name} is missing or still a placeholder.`);
  }
  return value;
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

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const environment = requiredEnv("GREENCHOICE_ENV").toLowerCase();
  if (!["development", "staging"].includes(environment)) {
    throw new Error("Administrator bootstrap is disabled in production. Use the reviewed production provisioning runbook.");
  }
  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== "true") {
    throw new Error("Set ALLOW_ADMIN_BOOTSTRAP=true for this explicit one-time operation.");
  }

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredEnv("ADMIN_EMAIL");
  const password = requiredEnv("ADMIN_INITIAL_PASSWORD");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const existingUser = await findUserByEmail(adminClient, email);
  const userMetadata = { full_name: "GreenChoice Administrator", role: "admin" };
  const authResult = existingUser
    ? await adminClient.auth.admin.updateUserById(existingUser.id, { email, password, email_confirm: true, user_metadata: userMetadata })
    : await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: userMetadata });

  if (authResult.error) throw authResult.error;
  const user = authResult.data.user;
  if (!user) throw new Error("Supabase Auth did not return a user.");

  const { error: profileError } = await adminClient.from("staff_profiles").upsert(
    {
      auth_user_id: user.id,
      user_id: user.id,
      email,
      full_name: "GreenChoice Administrator",
      role: "admin",
      account_status: "active",
      is_active: true
    },
    { onConflict: "auth_user_id" }
  );
  if (profileError) throw profileError;

  console.log(`${existingUser ? "Updated" : "Created"} the configured administrator.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
