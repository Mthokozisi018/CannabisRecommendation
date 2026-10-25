import { beforeEach, expect, it, vi } from "vitest";
import { createSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import type { SupplyStore } from "@/lib/master-supply/data";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/franchise/auth", () => ({ requireFranchiseAdmin: vi.fn(async () => ({ session: { authUserId: "actor" } })) }));
vi.mock("@/lib/security", () => ({ verifyOrigin: vi.fn(async () => {}), assertRateLimit: vi.fn(async () => {}) }));
vi.mock("@/lib/master-supply/data", () => ({ getFranchiseSupplySnapshot: vi.fn() }));

import { getFranchiseSupplySnapshot } from "@/lib/master-supply/data";
import { POST } from "@/app/api/dashboard/franchise/supply/history/export/route";

const store: SupplyStore = { id: "00000000-0000-4000-8000-000000000001", name: "Pretoria East", city: "Pretoria", province: "Gauteng", store_image_url: null, is_active: true, store_access_status: "active" };
beforeEach(() => {
  const snapshot = createSupplyDemoSnapshot("franchise", "actor", [store], new Date("2026-10-20T12:00:00Z"));
  vi.mocked(getFranchiseSupplySnapshot).mockResolvedValue(snapshot);
});

it("exports only the authenticated franchise snapshot rows matching the selected dates", async () => {
  const response = await POST(new Request("http://localhost/api/dashboard/franchise/supply/history/export", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ search: "Pretoria", storeId: store.id, status: "in_transit", from: "2026-10-19", to: "2026-10-19" })
  }));
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  const pdf = Buffer.from(await response.arrayBuffer()).toString("latin1");
  expect(pdf).toContain("Pretoria East");
  expect(pdf).toContain("in_transit");
  expect(pdf).not.toContain("delivered");
});
