import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isReadOnlyDemo } from "@/lib/demo-access";

export const hasReadOnlyDemoSession = cache(async () => {
  const client = await createSupabaseServerClient();
  if (!client) return false;
  const { data, error } = await client.auth.getUser();
  if (error) return false;
  return isReadOnlyDemo(data.user);
});
