import type { SupplierSummary, SupplyHistoryEntry } from "@/lib/manager/suppliers";

export function supplier(id: string, name: string): SupplierSummary {
  return { id, name, contactPerson: null, phone: null, email: null, address: null, description: null, logoUrl: null, logoPath: null, streetAddress: null, suburb: null, city: null, postalCode: null, paymentTerms: null, minimumOrderAmount: null, deliveryTimeDays: null, notes: null, status: "active", createdAt: "2026-09-01T08:00:00Z", updatedAt: "2026-09-01T08:00:00Z", categories: [{ id: `category-${id}`, category: "Accessories", subcategory: "Grinders" }], deliveryCount: 0, totalSpent: 0, totalStockSupplied: 0, lastDeliveryAt: null, products: [] };
}

export function supply(id: string, receivedAt: string, quantity: number, category = "Flower", supplierId = "budhouse"): SupplyHistoryEntry {
  return { id, deliveryId: id, reference: `REF-${id}`, supplierId, supplierName: supplierId === "budhouse" ? "BudHouse" : `Supplier ${supplierId.toUpperCase()}`, receivedAt, recordedBy: "Manager", productId: id, productName: `${category} ${id}`, category, subcategory: "Indoor", cultivationType: null, quantity, unit: "units", unitCost: 10, lineTotal: quantity * 10 };
}

export const suppliers = [supplier("a", "Supplier A"), supplier("b", "Supplier B"), supplier("c", "Supplier C"), supplier("budhouse", "BudHouse"), supplier("never", "Never Supplied")];
export const history = [
  supply("s1", "2026-09-03T08:00:00Z", 10, "Flower", "a"),
  supply("s2", "2026-09-09T08:00:00Z", 5, "Vape Cartridges", "b"),
  supply("s3", "2026-09-17T08:00:00Z", 15, "Flower", "a"),
  supply("s4", "2026-09-24T08:00:00Z", 8, "Accessories", "c"),
  supply("s5", "2026-09-27T08:00:00Z", 4, "Vape Cartridges", "b"),
  supply("s6", "2026-09-30T08:00:00Z", 30),
  supply("o1", "2026-10-01T08:00:00Z", 12, "Flower", "a"),
  supply("o2", "2026-10-02T08:00:00Z", 6, "Vape Cartridges", "b"),
  supply("o3", "2026-10-03T08:00:00Z", 20),
];
export const kpis = { activeSuppliers: 5, stockReceivedThisMonth: 38, supplyCostThisMonth: 380, deliveriesThisMonth: 3, lastSupplyAt: null, lastSupplierName: null };
