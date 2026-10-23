import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const preview = vi.hoisted(() => ({ kind: "fa" as "fa" | "manager", legacy: false, paid: false }));
vi.mock("@/lib/dashboard-session", () => ({ getDashboardSession: async () => ({
  staffProfileId: "owner", storeName: "GreenChoice Store", displayName: preview.kind === "fa" ? "Franchise Administrator" : "Store Manager",
}) }));
vi.mock("@/lib/billing/accounts", () => ({
  billingEnabled: () => true,
  billingAccountForSession: async () => ({ id: "billing", store_id: preview.kind === "fa" ? null : "store", franchise_id: preview.kind === "fa" ? "franchise" : null, owner_profile_id: "owner", status: "onboarding_due", onboarding_paid_at: preview.paid ? "2026-10-21T10:00:00Z" : null, grace_ends_at: null }),
  currentMonthlyPrice: async () => ({ amountCents: preview.kind === "fa" ? 250000 : 150000, count: 1 }),
  billingDb: () => ({ from: (table: string) => {
    const value = table === "franchises" ? { name: "GreenChoice Holdings", created_at: "2026-10-21T00:00:00Z" }
      : table === "stores" ? { name: "GreenChoice Store", city: "Pretoria", province: "Gauteng", created_at: "2026-10-21T00:00:00Z" } : null;
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query,
      single: async () => ({ data: value }), maybeSingle: async () => ({ data: table === "billing_subscriptions" && preview.paid
        ? { status: "active", monthly_amount_cents: preview.kind === "fa" ? 250000 : 150000, billable_store_count: 1, next_payment_at: "2026-11-21T10:00:00Z" }
        : table === "billing_payments" && preview.legacy
        ? { amount_cents: 450000, initial_monthly_amount_cents: null, initial_billable_store_count: null } : null }) };
    return query;
  } }),
}));
vi.mock("@/lib/billing/checkout-config", () => ({ paystackCheckoutCallbackUrl: () => "https://example.test/billing/payment/callback" }));
vi.mock("@/app/billing/actions", () => ({ startOnboardingCheckoutAction: async () => {}, startRecoveryCheckoutAction: async () => {}, updatePaymentMethodAction: async () => {} }));
vi.mock("@/app/billing/billing.module.css", () => ({ default: new Proxy({}, { get: (_target, property) => String(property) }) }));

describe("local billing visual previews", () => {
  it("renders FA and manager markup for screenshot review", async () => {
    const { default: BillingPage } = await import("@/app/billing/page");
    const root = process.cwd();
    const output = path.join(root, "artifacts", "billing-previews");
    await mkdir(output, { recursive: true });
    const css = await readFile(path.join(root, "app/billing/billing.module.css"), "utf8");
    const wallpaper = "file:///" + path.join(root, "public/images/backgrounds/receptionist-pos-wallpaper.png").replaceAll("\\", "/");
    for (const kind of ["fa", "manager"] as const) {
      preview.kind = kind;
      preview.legacy = false;
      const markup = renderToStaticMarkup(await BillingPage({ searchParams: Promise.resolve({}) }));
      expect(markup.match(/Pay securely with Paystack/g)).toHaveLength(1);
      expect(markup).toContain(kind === "fa" ? "R 7,000.00" : "R 4,000.00");
      expect(markup).toContain("First Month Hosting &amp; Subscription");
      expect(markup).toContain(`name="expectedAmountCents" value="${kind === "fa" ? "700000" : "400000"}"`);
      if (kind === "manager") expect(markup).not.toContain("Additional Stores");
      if (process.env.BILLING_PREVIEW !== "1") continue;
      const backdropCss = '.pointer-events-none{position:fixed;inset:0;overflow:hidden;background:#050909;z-index:0}.pointer-events-none>div{position:absolute;inset:0}.pointer-events-none>div:first-child{background-size:cover;background-position:center;background-repeat:no-repeat;opacity:.62;filter:saturate(1.25)}.pointer-events-none>div:nth-child(2){background:radial-gradient(circle at 70% 8%,rgba(127,255,74,.08),transparent 28%),linear-gradient(180deg,rgba(2,8,7,.28),rgba(0,0,0,.55))}.pointer-events-none>div:nth-child(3){left:-112px;top:-96px;width:430px;height:430px;border-radius:50%;background:radial-gradient(circle,rgba(109,210,75,.3),transparent 68%);filter:blur(48px)}.pointer-events-none>div:nth-child(4){inset:auto -120px -140px auto;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,rgba(93,186,70,.34),transparent 70%);filter:blur(48px)}.page>:not(.pointer-events-none){position:relative;z-index:1}';
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#050909;color:white}*{box-sizing:border-box}${css}${backdropCss}</style></head><body>${markup.replaceAll("/images/backgrounds/receptionist-pos-wallpaper.png", wallpaper)}</body></html>`;
      await writeFile(path.join(output, `billing-${kind}.html`), html);
    }
    preview.kind = "fa";
    preview.legacy = true;
    const legacy = renderToStaticMarkup(await BillingPage({ searchParams: Promise.resolve({}) }));
    expect(legacy).toContain("R 4,500.00");
    expect(legacy).toContain("This existing checkout charges onboarding only");
    expect(legacy).toContain('name="expectedAmountCents" value="450000"');
    preview.legacy = false;
    for (const kind of ["fa", "manager"] as const) {
      preview.kind = kind;
      preview.paid = true;
      const paid = renderToStaticMarkup(await BillingPage({ searchParams: Promise.resolve({}) }));
      expect(paid).toContain("Completed");
      expect(paid).toContain("Total due now</strong><strong>R 0.00");
      expect(paid).not.toContain("Pay securely with Paystack");
      expect(paid).toContain("Next payment: 21 Nov 2026");
    }
    preview.paid = false;
  });
});
