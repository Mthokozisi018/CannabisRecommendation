import { CATEGORIES, EFFECTS, PRODUCTS, STORE } from "../lib/data";

console.log(JSON.stringify({
  store: STORE,
  effects: EFFECTS.length,
  categories: CATEGORIES.map((category) => ({ slug: category.slug, subcategories: category.subcategories.length })),
  products: PRODUCTS.length,
  gelato33: PRODUCTS.find((product) => product.slug === "gelato-33")
}, null, 2));
