import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/GreenChoiceDashboard", () => ({
  GlassPanel: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
}));
vi.mock("@/app/dashboard/admin/actions", () => ({
  createManagerAccountAction: vi.fn(),
}));
vi.mock("@/app/manager/setup/actions", () => ({ completeManagerAccountSetupAction: vi.fn(), completeStoreRegistrationAction: vi.fn(), finishManagerOnboardingAction: vi.fn() }));
import { ManagerAccountSetupForm } from "@/components/manager/ManagerOnboarding";
import { AdminDashboardHome } from "@/components/admin/AdminDashboardUI";
import { CreateManagerAccountForm } from "@/components/admin/ConnectManagerForm";

describe("Admin dashboard navigation and manager form", () => {
  it("renders exactly the four approved cards and retains their destinations", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardHome
        stats={{
          totalStores: 0,
          totalManagers: 0,
          totalReceptionists: 0,
          activeSubscriptions: 0,
        }}
      />,
    );
    const links = [...html.matchAll(/href="(\/dashboard\/admin\/[^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(links).toEqual([
      "/dashboard/admin/franchises",
      "/dashboard/admin/connect-manager",
      "/dashboard/admin/stores",
      "/dashboard/admin/payments",
    ]);
    expect(html).toContain("Create Manager Account");
    expect(html).not.toContain("Connect Manager");
    expect(html).not.toContain("Demo Store");
    expect(html).not.toContain("Test Customer");
  });
  it("renders only manager email and one masked temporary password", () => {
    const html = renderToStaticMarkup(<CreateManagerAccountForm />);
    expect(html).toContain("Manager Email");
    expect(html).toContain("Temporary Password");
    expect(html).toContain('name="temporaryPassword"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).not.toContain('name="actorPassword"');
    expect(html.match(/type="password"/g)).toHaveLength(1);
    expect(html).toContain('Show temporary password');
    expect(html).not.toContain('minLength="12"');
    expect(html.match(/<(?:input|select|textarea)\b/g)).toHaveLength(2);
    for (const name of ["storeName", "storePhoneNumber", "physicalStoreAddress", "city", "province", "postalCode", "informationAccurate", "fullName", "phoneNumber"]) {
      expect(html).not.toContain(`name="${name}"`);
    }
    expect(html).toContain("Create Manager Account");
    expect(html).not.toContain("Connect an existing");
  });
  it("uses one new-password field during manager onboarding", () => {
    const html = renderToStaticMarkup(<ManagerAccountSetupForm
      legalDocuments={{ available:true, termsHref:"/terms", privacyHref:"/privacy", missingLabels:[] }}
      initialValues={{fullName:"",surname:"",physicalAddress:"",phoneNumber:"",city:"",province:"",postalCode:""}}
      mustChangePassword accountEmail="manager@example.com" />);
    expect(html.match(/type="password"/g)).toHaveLength(1);
    expect(html).not.toContain("confirmPermanentPassword");
    expect(html).not.toContain('minLength="12"');
    expect(html).toContain("Continue to Store Registration");
  });
});
