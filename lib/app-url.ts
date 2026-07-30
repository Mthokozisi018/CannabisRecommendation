import "server-only";

export function configuredApplicationUrl() {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.NODE_ENV !== "production" && process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.trim()}`
      : "");
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("The production application URL is not configured.");
    }
    return "http://127.0.0.1:3001";
  }
  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("The production application URL must use HTTPS.");
  }
  return url.origin;
}
