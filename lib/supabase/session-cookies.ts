export function supabaseSessionCookieBaseName(supabaseUrl: string | undefined) {
  if (!supabaseUrl) return null;
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

export function isSupabaseSessionCookieName(name: string, supabaseUrl: string | undefined) {
  const baseName = supabaseSessionCookieBaseName(supabaseUrl);
  if (!baseName) return false;
  if (name === baseName) return true;
  if (!name.startsWith(`${baseName}.`)) return false;
  return /^[0-9]+$/.test(name.slice(baseName.length + 1));
}

export function supabaseSessionCookieNames(cookies: Array<{ name: string }>, supabaseUrl: string | undefined) {
  return cookies
    .map(({ name }) => name)
    .filter((name) => isSupabaseSessionCookieName(name, supabaseUrl));
}
