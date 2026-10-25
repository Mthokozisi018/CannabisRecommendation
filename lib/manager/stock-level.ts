export function inventoryStockLevel(quantity: number, threshold: number) {
  if (quantity <= 0) return "out_of_stock";
  return threshold > 0 && quantity <= threshold ? "low_stock" : "in_stock";
}
