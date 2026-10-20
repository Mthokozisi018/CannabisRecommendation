export const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 8_000;
export const AUTH_BOUNDARY_FETCH_TIMEOUT_MS = 2_500;

function timeoutSignal(timeoutMs: number) {
  return AbortSignal.timeout(Math.max(1, timeoutMs));
}

function combinedSignal(existing: AbortSignal | null | undefined, timeoutMs: number) {
  const timeout = timeoutSignal(timeoutMs);
  if (!existing) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([existing, timeout]);

  const controller = new AbortController();
  const abort = () => controller.abort();
  existing.addEventListener("abort", abort, { once: true });
  timeout.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

export function createSupabaseFetch(timeoutMs = DEFAULT_SUPABASE_FETCH_TIMEOUT_MS): typeof fetch {
  return (input, init) => fetch(input, {
    ...init,
    signal: combinedSignal(init?.signal, timeoutMs)
  });
}
