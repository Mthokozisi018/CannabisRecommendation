import "server-only";
import type { AuditEventInput } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sensitiveKeys = new Set(["password", "token", "secret", "authorization", "cookie", "email", "phone", "note"]);

function sanitize(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/[\r\n|]/g, " ").slice(0, 500);
  if (Array.isArray(value)) return value.map(sanitize).slice(0, 50);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sensitiveKeys.has(key.toLowerCase()) ? "[REDACTED]" : sanitize(entry)
      ])
    );
  }
  return value;
}

export function logSecurityEvent(event: AuditEventInput) {
  const safe = sanitize(event) as Record<string, unknown>;
  console.info(JSON.stringify({ type: "security_event", ...safe, timestamp: new Date().toISOString() }));
}

export async function writeAuditEvent(event: AuditEventInput) {
  logSecurityEvent(event);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  await supabase.from("audit_events").insert({
    store_id: event.tenantId,
    actor_user_id: event.actorId,
    action: event.action,
    entity_type: event.targetType,
    entity_id: event.targetId,
    result: event.result,
    interaction_id: event.interactionId,
    metadata_json: sanitize(event.metadata ?? {})
  });
}
