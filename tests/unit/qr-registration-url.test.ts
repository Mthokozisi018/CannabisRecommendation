import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getStoreRegistrationUrl } from "@/lib/registration/url";
const store = { registrationToken: "a".repeat(64) };
describe("canonical public store registration URL", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("uses the configured production origin and current registration route", () => {
    vi.stubEnv("APP_URL", "https://greenchoice.example.invalid/");
    expect(getStoreRegistrationUrl(store)).toBe(`https://greenchoice.example.invalid/register/${store.registrationToken}`);
  });
  it("uses the public application URL when the server application URL is absent", () => {
    vi.stubEnv("APP_URL", ""); vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3001"); vi.stubEnv("NODE_ENV", "development");
    expect(getStoreRegistrationUrl(store)).toBe(`http://127.0.0.1:3001/register/${store.registrationToken}`);
  });
  it.each(["", "undefined", "1", "store-uuid", "../../login"])("rejects invalid public identifiers: %s", value => {
    expect(() => getStoreRegistrationUrl({ registrationToken: value })).toThrow("identifier");
  });
  it("requires a configured HTTPS production URL", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_URL", "http://localhost:3001");
    expect(() => getStoreRegistrationUrl(store)).toThrow("HTTPS");
  });
});
