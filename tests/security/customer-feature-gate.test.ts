import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("customer experience feature gate", () => {
  it("defaults off and protects customer pages and APIs", () => {
    expect(source("lib/feature-flags.ts")).toContain(": false");
    expect(source("proxy.ts")).toContain("customerApiPrefixes");
    expect(source("proxy.ts")).toContain("status: 404");
    expect(source("app/customer/layout.tsx")).toContain("if (!isCustomerExperienceEnabled()) notFound()");
  });

  it("only resolves customer login sessions when enabled", () => {
    expect(source("app/api/auth/login/route.ts")).toContain("isCustomerExperienceEnabled() ? await getCustomerSessionForVerifiedUser");
    expect(source("app/api/auth/login-form/route.ts")).toContain("isCustomerExperienceEnabled() ? await getCustomerSessionForVerifiedUser");
    expect(source("app/api/auth/access-decision/route.ts")).toContain("if (isCustomerExperienceEnabled())");
  });

  it("redirects visibly unauthenticated staff routes before rendering", () => {
    const proxy = source("proxy.ts");
    expect(proxy).toContain("refreshSupabaseSession");
    expect(proxy).toContain("if (!refreshed.authenticated)");
    expect(proxy).toContain("loginRedirect(request, requestId, nonce, error)");
  });
});
