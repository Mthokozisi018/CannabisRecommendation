export function money(cents: number, currencyCode = "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: currencyCode }).format(cents / 100);
}

export function percent(value?: number, unit = "%") {
  if (value === undefined || value === null) return "N/A";
  return `${value}${unit}`;
}
