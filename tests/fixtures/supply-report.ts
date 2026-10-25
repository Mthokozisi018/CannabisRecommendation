import type { SupplyDelivery, SupplyLine, SupplyReportSource } from "@/lib/manager/supply-report";

export function delivery(id: string, createdAt: string, supplierId = "budhouse", recorder = "manager-a", total = 100): SupplyDelivery {
  return { id, supplier_id: supplierId, reference: `SUP-${id}`, created_at: createdAt, received_at: createdAt, recorded_by: recorder, total_cost: total };
}
export function line(id: string, deliveryId: string, category = "Flower", quantity = 10, unitCost = 10): SupplyLine {
  return { id, delivery_id: deliveryId, product_id: `product-${id}`, product_name_snapshot: `Product ${id}`, category_snapshot: category, quantity, unit: "units", unit_cost: unitCost, line_total: quantity * unitCost };
}
export const supplySource: SupplyReportSource = {
  suppliers: [{ id: "budhouse", name: "BudHouse", status: "active" }, { id: "cape", name: "Cape Supply", status: "active" }, { id: "never", name: "Never Supplied", status: "inactive" }],
  staff: [
    { auth_user_id: "manager-a", user_id: null, full_name: "Msizi Test", first_name: null, surname: null, email: null, role: "manager" },
    { auth_user_id: "manager-b", user_id: null, full_name: "Msizi Test", first_name: null, surname: null, email: null, role: "manager" },
    { auth_user_id: "receptionist", user_id: null, full_name: "Bongi Test", first_name: null, surname: null, email: null, role: "receptionist" },
  ],
  deliveries: [
    delivery("oct-1", "2026-10-08T07:30:00Z", "budhouse", "manager-a", 150),
    delivery("oct-2", "2026-10-08T06:00:00Z", "budhouse", "manager-b"),
    delivery("sept-1", "2026-09-09T07:00:00Z", "cape", "manager-b"),
    delivery("sept-2", "2026-09-30T12:00:00Z", "budhouse", "manager-a"),
  ],
  items: [line("flower", "oct-1"), line("accessory", "oct-1", "Accessories", 5), line("oct-other", "oct-2"), line("vape", "sept-1", "Vape Cartridges"), line("historic", "sept-2")],
};
