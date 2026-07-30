export const dashboardVisuals = {
  manager: {
    dashboard: "/images/manager/dashboard.png",
    products: "/images/manager/products-landing.png",
    inventory: "/images/manager/inventory-by-category.png"
  },
  receptionist: {
    dashboard: "/images/receptionist/dashboard.png",
    concentrates: "/images/receptionist/concentrates.png",
    customerSignIn: "/images/receptionist/customer-sign-in.png",
    ediblesBeverages: "/images/receptionist/edibles-beverages.png",
    ediblesChocolates: "/images/receptionist/edibles-chocolates.png",
    ediblesCookies: "/images/receptionist/edibles-cookies.png",
    ediblesGummies: "/images/receptionist/edibles-gummies.png",
    flowers: "/images/receptionist/flowers.png",
    flowersVariations: "/images/receptionist/flowers-variations.png",
    oil: "/images/receptionist/oil.png",
    preRolls: "/images/receptionist/pre-rolls.png",
    vapeBattery: "/images/receptionist/vape-battery.png",
    vapeCartridges: "/images/receptionist/vape-cartridges.png",
    vapeDisposable: "/images/receptionist/vape-disposable.png"
  }
};

export function visualForGreenChoiceCategory(categorySlug?: string, subcategory?: string) {
  const category = categorySlug?.toLowerCase() ?? "";
  const detail = subcategory?.toLowerCase() ?? "";

  if (category.includes("flower")) return detail && !detail.includes("indoor") ? dashboardVisuals.receptionist.flowersVariations : dashboardVisuals.receptionist.flowers;
  if (category.includes("concentrate")) return dashboardVisuals.receptionist.concentrates;
  if (category.includes("pre")) return dashboardVisuals.receptionist.preRolls;
  if (category.includes("vape") || category.includes("cartridge")) {
    if (detail.includes("battery")) return dashboardVisuals.receptionist.vapeBattery;
    if (detail.includes("cartridge")) return dashboardVisuals.receptionist.vapeCartridges;
    return dashboardVisuals.receptionist.vapeDisposable;
  }
  if (category.includes("beverage") || detail.includes("beverage")) return dashboardVisuals.receptionist.ediblesBeverages;
  if (category.includes("edible")) {
    if (detail.includes("chocolate")) return dashboardVisuals.receptionist.ediblesChocolates;
    if (detail.includes("cookie") || detail.includes("baked")) return dashboardVisuals.receptionist.ediblesCookies;
    return dashboardVisuals.receptionist.ediblesGummies;
  }

  return dashboardVisuals.receptionist.oil;
}
