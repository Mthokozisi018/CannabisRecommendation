import "server-only";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type LogLevel = "debug" | "info" | "warn" | "error";
type SafeContext = Record<string, unknown>;

type AuditEventInput = {
  interactionId: string;
  actorId: string;
  tenantId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  result: string;
  metadata?: Record<string, unknown>;
};

const uuidSchema = z.string().uuid();

const sensitiveKeyPattern = /password|token|secret|authorization|cookie|email|phone|address|invite.*link|recovery.*link/i;

function redactString(value: string) {
  let safe = value
    .replace(/bearer\s+[a-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:token|code|access_token|refresh_token|password)=)[^&\s]+/gi, "$1[REDACTED]");
  const configuredSecrets = [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.RATE_LIMIT_REDIS_REST_TOKEN,
    process.env.UPSTASH_REDIS_REST_TOKEN,
    process.env.CSRF_SECRET,
    process.env.SESSION_SIGNING_SECRET,
    process.env.GREENCHOICE_PASSWORD_FINGERPRINT_SECRET
  ].filter((item): item is string => Boolean(item && item.length >= 8));
  for (const secret of configuredSecrets) safe = safe.split(secret).join("[REDACTED]");
  return safe.slice(0, 500);
}

function safeValue(value: unknown, key = "", depth = 0): unknown {
  if (sensitiveKeyPattern.test(key)) return "[REDACTED]";
  if (depth > 4) return "[TRUNCATED]";
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) {
    return {
      name: value.name.slice(0, 120),
      message: redactString(value.message)
    };
  }
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => safeValue(item, key, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([entryKey, entryValue]) => [entryKey, safeValue(entryValue, entryKey, depth + 1)])
    );
  }
  return String(value).slice(0, 500);
}

function shouldLog(level: LogLevel) {
  const configured = process.env.GREENCHOICE_LOG_LEVEL ?? "info";
  const ranks: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
  return ranks[level] >= (ranks[configured as LogLevel] ?? ranks.info);
}

export async function currentRequestId() {
  try {
    return (await headers()).get("x-request-id")?.slice(0, 120) ?? null;
  } catch {
    return null;
  }
}

export async function logServerEvent(level: LogLevel, event: string, context: SafeContext = {}) {
  if (!shouldLog(level)) return;
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event: event.slice(0, 120),
    requestId: await currentRequestId(),
    environment: process.env.GREENCHOICE_ENV ?? process.env.NODE_ENV ?? "unknown",
    context: safeValue(context)
  };
  const serialized = JSON.stringify(payload);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.info(serialized);
}

export async function reportServerException(event: string, error: unknown, context: SafeContext = {}) {
  const safeError = safeValue(error, "error");
  await logServerEvent("error", event, { ...context, error: safeError });

  Sentry.withScope((scope) => {
    scope.setTag("greenchoice.event", event.slice(0, 120));
    scope.setContext("greenchoice", safeValue(context) as Record<string, unknown>);
    Sentry.captureException(error instanceof Error ? error : new Error(String(safeError)));
  });

  const endpoint = process.env.ERROR_REPORTING_DSN?.trim();
  if (!endpoint) return;
  try {
    const url = new URL(endpoint);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: event.slice(0, 120),
        requestId: await currentRequestId(),
        environment: process.env.GREENCHOICE_ENV ?? process.env.NODE_ENV ?? "unknown",
        error: safeError,
        context: safeValue(context)
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(2_000)
    });
  } catch {
    // Exception reporting must never replace the original application outcome.
  }
}

export async function writeAuditEvent(input: AuditEventInput) {
  await logServerEvent("info", "business_audit_event", {
    interactionId: input.interactionId,
    actorId: input.actorId,
    tenantId: input.tenantId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    result: input.result,
    metadata: input.metadata
  });

  const actorId = uuidSchema.safeParse(input.actorId);
  const storeId = uuidSchema.safeParse(input.tenantId);
  const targetId = input.targetId ? uuidSchema.safeParse(input.targetId) : null;
  if (!actorId.success || !storeId.success || (targetId && !targetId.success)) return;

  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.from("audit_events").insert({
    store_id: storeId.data,
    actor_user_id: actorId.data,
    entity_type: input.targetType.slice(0, 120),
    entity_id: targetId?.success ? targetId.data : null,
    action: input.action.slice(0, 160),
    after_json: {
      interactionId: input.interactionId.slice(0, 120),
      result: input.result.slice(0, 80),
      metadata: safeValue(input.metadata ?? {})
    }
  });
  if (error) {
    await logServerEvent("warn", "business_audit_database_write_failed", {
      action: input.action,
      targetType: input.targetType
    });
  }
}
