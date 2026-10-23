export type AuthSessionFailureCategory = "invalid_session" | "temporary_service_failure" | "unknown";

type ErrorRecord = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
  cause?: unknown;
};

function asRecord(error: unknown): ErrorRecord {
  return error && typeof error === "object" ? error as ErrorRecord : {};
}

export function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  const message = asRecord(error).message;
  return typeof message === "string" ? message : String(error ?? "");
}

export function safeErrorName(error: unknown) {
  if (error instanceof Error) return error.name;
  const name = asRecord(error).name;
  return typeof name === "string" ? name : "Error";
}

function errorCode(error: unknown) {
  const code = asRecord(error).code;
  return typeof code === "string" ? code.toLowerCase() : "";
}

function errorStatus(error: unknown) {
  const status = asRecord(error).status;
  return typeof status === "number" ? status : null;
}

export function isInvalidSupabaseSessionError(error: unknown) {
  const message = safeErrorMessage(error).toLowerCase();
  const code = errorCode(error);
  return [
    "refresh_token_not_found",
    "invalid_refresh_token",
    "refresh_token_already_used",
    "session_not_found",
    "bad_jwt",
    "jwt_expired"
  ].some((value) => code.includes(value) || message.includes(value.replaceAll("_", " "))) ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("auth session missing") ||
    message.includes("jwt expired");
}

export function isTemporaryDependencyError(error: unknown) {
  const status = errorStatus(error);
  if (status !== null && (status === 408 || status === 429 || status >= 500)) return true;

  const name = safeErrorName(error).toLowerCase();
  const message = safeErrorMessage(error).toLowerCase();
  return name.includes("timeouterror") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("gateway timeout") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable");
}

export function classifySupabaseAuthSessionError(error: unknown): AuthSessionFailureCategory {
  if (isInvalidSupabaseSessionError(error)) return "invalid_session";
  if (isTemporaryDependencyError(error)) return "temporary_service_failure";
  return "unknown";
}

export class AuthDependencyUnavailableError extends Error {
  readonly category = "temporary_service_failure" as const;
  readonly dependency: string;

  constructor(dependency = "supabase_auth", message = "Authentication is temporarily unavailable.") {
    super(message);
    this.name = "AuthDependencyUnavailableError";
    this.dependency = dependency;
  }
}

export class AccountLookupUnavailableError extends Error {
  readonly category = "account_lookup_failed" as const;
  readonly stage: string;
  readonly originalName: string;
  readonly temporary: boolean;

  constructor(stage: string, cause: unknown, message = "Account details are temporarily unavailable.") {
    super(message);
    this.name = "AccountLookupUnavailableError";
    this.stage = stage;
    this.originalName = safeErrorName(cause);
    this.temporary = isTemporaryDependencyError(cause);
  }
}

export class StaffAuthenticationRequiredError extends Error {
  readonly category = "invalid_session" as const;

  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "StaffAuthenticationRequiredError";
  }
}
