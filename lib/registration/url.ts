import "server-only";
import { configuredApplicationUrl } from "@/lib/app-url";

/** Public URLs use the permanent random token, never a browser-supplied store ID. */
export function getStoreRegistrationUrl(store: { registrationToken: string }) {
  if (!/^[a-f0-9]{64}$/.test(store.registrationToken)) throw new Error("The store registration identifier is invalid.");
  const origin = configuredApplicationUrl();
  const url = new URL(`/register/${store.registrationToken}`, origin);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("The registration URL is invalid.");
  return url.href;
}
