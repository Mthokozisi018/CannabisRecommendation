import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readRegistrationReceipt, signRegistrationReceipt } from "@/lib/registration/receipt";
describe("registration success receipt", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  it("is signed, short-lived and contains only masked contact information", () => {
    vi.stubEnv("SESSION_SIGNING_SECRET", "test-secret-with-at-least-32-characters");
    vi.useFakeTimers();
    const token = signRegistrationReceipt("Store A", "082 *** 4567");
    expect(readRegistrationReceipt(token)).toMatchObject({ storeName: "Store A", maskedPhone: "082 *** 4567" });
    expect(readRegistrationReceipt(token + "changed")).toBeNull();
    expect(readRegistrationReceipt(token + ".extra")).toBeNull();
    vi.advanceTimersByTime(900_001);
    expect(readRegistrationReceipt(token)).toBeNull();
  });
  it("does not invent success for a missing cookie", () => expect(readRegistrationReceipt()).toBeNull());
});
