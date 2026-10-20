import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Server-side Supabase cleanup configuration is required.");
const admin = createClient(url, key, { auth: { persistSession: false } });
// Run every 15 minutes. The one-hour grace period avoids deleting in-flight documents.
const cutoff = new Date(Date.now() - 60 * 60_000).toISOString();
const { data, error } = await admin.from("qr_document_cleanup").select("path").lt("created_at", cutoff).order("created_at").limit(500);
if (error) throw new Error("Document cleanup queue is unavailable.");
let removed = 0;
for (const entry of data ?? []) {
  const result = await admin.storage.from("registration-documents").remove([entry.path]);
  if (result.error) continue;
  const deleted = await admin.from("qr_document_cleanup").delete().eq("path", entry.path);
  if (!deleted.error) removed++;
}
console.log(`Temporary registration documents cleaned: ${removed}; pending retries: ${(data?.length ?? 0) - removed}.`);
if (removed !== (data?.length ?? 0)) process.exitCode = 1;
