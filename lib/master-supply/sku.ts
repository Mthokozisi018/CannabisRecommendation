const categoryCodes: Record<string,string> = {
  Flower: "FLW", "Pre-Rolls": "PRL", Edibles: "EDB", Accessories: "ACC",
  "Vape Cartridges": "VAP", "Disposable Vapes": "VAP", Concentrates: "CON", Beverages: "BEV"
};

export function masterSupplySku(category:string,id:string) {
  return `GC-MS-${categoryCodes[category]??"PRD"}-${id.replace(/-/g,"").slice(0,12).toUpperCase()}`;
}
