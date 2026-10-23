import "server-only";
import { requireActiveManager, requireAdminClient } from "@/lib/manager/auth";
import { requireAssignedStoreId } from "@/lib/store-scope";

export type SupplierCategory = { id: string; category: string; subcategory: string };
export type SupplierProduct = { id: string; name: string; category: string; subcategory: string; strainType: string | null; cultivationType: string | null; currentStock: number; imageUrl: string | null };

export type SupplierSummary = {
  id: string; name: string; contactPerson: string | null; phone: string | null; email: string | null;
  address: string | null; description: string | null; logoUrl: string | null; logoPath: string | null;
  streetAddress: string | null; suburb: string | null; city: string | null; postalCode: string | null;
  paymentTerms: string | null; minimumOrderAmount: number | null; deliveryTimeDays: string | null; notes: string | null;
  status: "active" | "inactive"; createdAt: string; updatedAt: string; categories: SupplierCategory[];
  deliveryCount: number; totalSpent: number; totalStockSupplied: number; lastDeliveryAt: string | null; products: SupplierProduct[];
};

export type SupplyHistoryEntry = {
  id: string; deliveryId: string; reference: string; supplierId: string; supplierName: string; receivedAt: string;
  recordedBy: string; productId: string; productName: string; category: string; subcategory: string;
  cultivationType: string | null; quantity: number; unit: "grams" | "units"; unitCost: number; lineTotal: number;
};

export type SupplierKpis = {
  activeSuppliers: number; stockReceivedThisMonth: number; supplyCostThisMonth: number;
  deliveriesThisMonth: number; lastSupplyAt: string | null; lastSupplierName: string | null;
};

type SupplierRow = {
  id: string; name: string; contact_person: string | null; phone: string | null; email: string | null;
  address: string | null; description: string | null; logo_url: string | null; logo_path: string | null;
  street_address: string | null; suburb: string | null; city: string | null; postal_code: string | null;
  payment_terms: string | null; minimum_order_amount: number | null; delivery_time_days: string | null;
  notes: string | null; status: "active" | "inactive"; created_at: string; updated_at: string;
};
type DeliveryRow = { id: string; supplier_id: string; reference: string; received_at: string; recorded_by: string | null; total_cost: number };
type DeliveryItemRow = { id: string; delivery_id: string; product_id: string; product_name_snapshot: string; category_snapshot: string; subcategory_snapshot: string; cultivation_type_snapshot: string | null; quantity: number; unit: "grams" | "units"; unit_cost: number; line_total: number };
type ProductRow = { id: string; product_name: string | null; name: string; category: string | null; subcategory: string | null; strain_type: string | null; cultivation_type: string | null; grow_type: string | null; image_url: string | null; inventory_stock: { current_quantity: number }[] | { current_quantity: number } | null };

function addToMap<T>(map: Map<string, T[]>, key: string, value: T) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export async function listManagerSupplierData(supplierId?: string) {
  const { profile } = await requireActiveManager();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const admin = requireAdminClient();
  const supplierQuery = admin.from("suppliers").select("id, name, contact_person, phone, email, address, description, logo_url, logo_path, street_address, suburb, city, postal_code, payment_terms, minimum_order_amount, delivery_time_days, notes, status, created_at, updated_at").eq("store_id", storeId).order("name");
  const categoryQuery = admin.from("supplier_categories").select("id, supplier_id, category, subcategory").eq("store_id", storeId).order("category").order("subcategory");
  const deliveryQuery = admin.from("supply_deliveries").select("id, supplier_id, reference, received_at, recorded_by, total_cost").eq("store_id", storeId).order("received_at", { ascending: false });
  const [supplierResult, categoryResult, deliveryResult, staffResult, productResult] = await Promise.all([
    supplierId ? supplierQuery.eq("id", supplierId) : supplierQuery,
    supplierId ? categoryQuery.eq("supplier_id", supplierId) : categoryQuery,
    supplierId ? deliveryQuery.eq("supplier_id", supplierId) : deliveryQuery,
    admin.from("staff_profiles").select("auth_user_id, full_name, first_name, surname, email").eq("store_id", storeId),
    admin.from("products").select("id, product_name, name, category, subcategory, strain_type, cultivation_type, grow_type, image_url, inventory_stock(current_quantity)").eq("store_id", storeId).is("deleted_at", null)
  ]);
  const itemQuery = admin.from("supply_delivery_items").select("id, delivery_id, product_id, product_name_snapshot, category_snapshot, subcategory_snapshot, cultivation_type_snapshot, quantity, unit, unit_cost, line_total").eq("store_id", storeId);
  const deliveryIds = (deliveryResult.data ?? []).map(delivery => delivery.id);
  const itemResult = supplierId ? deliveryIds.length ? await itemQuery.in("delivery_id", deliveryIds) : { data: [], error: null } : await itemQuery;
  const error = supplierResult.error ?? categoryResult.error ?? deliveryResult.error ?? itemResult.error ?? staffResult.error ?? productResult.error;
  if (error) throw new Error(error.message);

  const supplierRows = (supplierResult.data ?? []) as SupplierRow[];
  const deliveryRows = (deliveryResult.data ?? []) as DeliveryRow[];
  const itemRows = (itemResult.data ?? []) as DeliveryItemRow[];
  const productRows = (productResult.data ?? []) as ProductRow[];
  const supplierNames = new Map(supplierRows.map((supplier) => [supplier.id, supplier.name]));
  const staffNames = new Map((staffResult.data ?? []).map((staff) => [staff.auth_user_id, staff.full_name || [staff.first_name, staff.surname].filter(Boolean).join(" ") || staff.email]));
  const deliveryById = new Map(deliveryRows.map((delivery) => [delivery.id, delivery]));
  const productById = new Map(productRows.map((product) => [product.id, product]));
  const categoriesBySupplier = new Map<string, SupplierCategory[]>();
  const deliveriesBySupplier = new Map<string, DeliveryRow[]>();
  const historyBySupplier = new Map<string, SupplyHistoryEntry[]>();
  const productIdsBySupplier = new Map<string, Set<string>>();
  for (const mapping of categoryResult.data ?? []) addToMap(categoriesBySupplier, mapping.supplier_id, { id: mapping.id, category: mapping.category, subcategory: mapping.subcategory });
  for (const delivery of deliveryRows) addToMap(deliveriesBySupplier, delivery.supplier_id, delivery);

  const history: SupplyHistoryEntry[] = [];
  for (const item of itemRows) {
    const delivery = deliveryById.get(item.delivery_id);
    if (!delivery) continue;
    const entry: SupplyHistoryEntry = {
      id: item.id, deliveryId: delivery.id, reference: delivery.reference, supplierId: delivery.supplier_id,
      supplierName: supplierNames.get(delivery.supplier_id) ?? "Supplier", receivedAt: delivery.received_at,
      recordedBy: delivery.recorded_by ? staffNames.get(delivery.recorded_by) ?? "Manager" : "Manager",
      productId: item.product_id, productName: item.product_name_snapshot, category: item.category_snapshot,
      subcategory: item.subcategory_snapshot, cultivationType: item.cultivation_type_snapshot,
      quantity: Number(item.quantity), unit: item.unit, unitCost: Number(item.unit_cost), lineTotal: Number(item.line_total)
    };
    history.push(entry);
    addToMap(historyBySupplier, delivery.supplier_id, entry);
    const ids = productIdsBySupplier.get(delivery.supplier_id) ?? new Set<string>();
    ids.add(item.product_id);
    productIdsBySupplier.set(delivery.supplier_id, ids);
  }
  history.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  for (const entries of historyBySupplier.values()) entries.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const suppliers: SupplierSummary[] = supplierRows.map((supplier) => {
    const deliveries = deliveriesBySupplier.get(supplier.id) ?? [];
    const supplierHistory = historyBySupplier.get(supplier.id) ?? [];
    const products = [...(productIdsBySupplier.get(supplier.id) ?? new Set())].flatMap((id): SupplierProduct[] => {
      const product = productById.get(id);
      if (!product) return [];
      const stock = Array.isArray(product.inventory_stock) ? product.inventory_stock[0] : product.inventory_stock;
      return [{ id: product.id, name: product.product_name || product.name, category: product.category ?? "Uncategorised", subcategory: product.subcategory ?? "-", strainType: product.strain_type, cultivationType: product.cultivation_type ?? product.grow_type, currentStock: Number(stock?.current_quantity ?? 0), imageUrl: product.image_url }];
    }).sort((a, b) => a.name.localeCompare(b.name));
    return {
      id: supplier.id, name: supplier.name, contactPerson: supplier.contact_person, phone: supplier.phone,
      email: supplier.email, address: supplier.address, description: supplier.description, logoUrl: supplier.logo_url,
      logoPath: supplier.logo_path, streetAddress: supplier.street_address, suburb: supplier.suburb, city: supplier.city,
      postalCode: supplier.postal_code, paymentTerms: supplier.payment_terms,
      minimumOrderAmount: supplier.minimum_order_amount === null ? null : Number(supplier.minimum_order_amount),
      deliveryTimeDays: supplier.delivery_time_days, notes: supplier.notes, status: supplier.status,
      createdAt: supplier.created_at, updatedAt: supplier.updated_at, categories: categoriesBySupplier.get(supplier.id) ?? [],
      deliveryCount: deliveries.length, totalSpent: deliveries.reduce((sum, delivery) => sum + Number(delivery.total_cost), 0),
      totalStockSupplied: supplierHistory.reduce((sum, item) => sum + item.quantity, 0), lastDeliveryAt: deliveries[0]?.received_at ?? null, products
    };
  });

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthlyHistory = history.filter((item) => new Date(item.receivedAt) >= monthStart);
  const monthlyDeliveries = deliveryRows.filter((delivery) => new Date(delivery.received_at) >= monthStart);
  const latestDelivery = deliveryRows[0];
  const kpis: SupplierKpis = {
    activeSuppliers: suppliers.filter((supplier) => supplier.status === "active").length,
    stockReceivedThisMonth: monthlyHistory.reduce((sum, item) => sum + item.quantity, 0),
    supplyCostThisMonth: monthlyDeliveries.reduce((sum, delivery) => sum + Number(delivery.total_cost), 0),
    deliveriesThisMonth: monthlyDeliveries.length, lastSupplyAt: latestDelivery?.received_at ?? null,
    lastSupplierName: latestDelivery ? supplierNames.get(latestDelivery.supplier_id) ?? "Supplier" : null
  };
  return { suppliers, history, kpis };
}

export async function listActiveManagerSuppliers() {
  const { profile } = await requireActiveManager();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const admin = requireAdminClient();
  const [supplierResult, categoryResult] = await Promise.all([
    admin.from("suppliers").select("id, name").eq("store_id", storeId).eq("status", "active").order("name"),
    admin.from("supplier_categories").select("supplier_id, category, subcategory").eq("store_id", storeId)
  ]);
  const error = supplierResult.error ?? categoryResult.error;
  if (error) throw new Error(error.message);
  const mappings = new Map<string, { category: string; subcategory: string }[]>();
  for (const mapping of categoryResult.data ?? []) addToMap(mappings, mapping.supplier_id, { category: mapping.category, subcategory: mapping.subcategory });
  return (supplierResult.data ?? []).map((supplier) => ({ id: supplier.id, name: supplier.name, categories: mappings.get(supplier.id) ?? [] }));
}
