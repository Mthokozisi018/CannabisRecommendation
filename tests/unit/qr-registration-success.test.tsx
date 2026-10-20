import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
const { cookie } = vi.hoisted(() => ({ cookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
import SuccessPage from "@/app/register/success/page";
import { signRegistrationReceipt } from "@/lib/registration/receipt";
describe("mobile registration confirmation", () => {
  beforeEach(() => { vi.stubEnv("SESSION_SIGNING_SECRET", "test-secret-with-at-least-32-characters"); cookie.mockReturnValue(undefined); });
  it("shows only the signed store name and masked cellphone after registration", async () => {
    cookie.mockReturnValue({ value: signRegistrationReceipt("Store A", "082 *** 4567") });
    const html = renderToStaticMarkup(await SuccessPage());
    expect(html).toContain("Registration Successful"); expect(html).toContain("customer of Store A"); expect(html).toContain("082 *** 4567");
    expect(html).toContain('href="/registration-complete"'); expect(html).not.toContain("0821234567"); expect(html).not.toContain("<img");
  });
  it("cannot claim success without a valid receipt", async () => {
    const html = renderToStaticMarkup(await SuccessPage()); expect(html).toContain("confirmation unavailable"); expect(html).not.toContain("Registration Successful");
  });
});
