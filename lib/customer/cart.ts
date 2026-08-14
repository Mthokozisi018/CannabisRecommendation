import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type CustomerCartItem = {
  id: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  stockAvailable: number;
};

export type CustomerCartPayload = {
  id: string | null;
  storeId: string | null;
  storeName: string | null;
  items: CustomerCartItem[];
  itemCount: number;
  subtotal: number;
};

const emptyCart: CustomerCartPayload = { id: null, storeId: null, storeName: null, items: [], itemCount: 0, subtotal: 0 };

export async function readCustomerCart(userId: string): Promise<CustomerCartPayload> {
  const admin = createSupabaseAdminClient();
  if (!admin) return emptyCart;
  const { data: cart, error: cartError } = await admin
    .from("carts")
    .select("id,store_id,updated_at,stores(name),cart_items(id,product_id,quantity)")
    .eq("created_by_user_id", userId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cartError) throw new Error("Unable to read your cart.");
  if (!cart) return emptyCart;

  const rawItems = (cart.cart_items ?? []) as Array<{ id: string; product_id: string; quantity: number }>;
  const productIds = rawItems.map((item) => item.product_id);
  if (productIds.length === 0) {
    const storeRelation = cart.stores as { name?: string } | Array<{ name?: string }> | null;
    const store = Array.isArray(storeRelation) ? storeRelation[0] : storeRelation;
    return { ...emptyCart, id: cart.id, storeId: cart.store_id, storeName: store?.name ?? null };
  }

  const { data: products, error: productError } = await admin
    .from("products")
    .select("id,product_name,price,image_url,image_path,product_status,is_visible_on_pos,is_published,deleted_at,inventory_stock(current_quantity)")
    .in("id", productIds);
  if (productError) throw new Error("Unable to read the products in your cart.");
  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const items = rawItems.flatMap((item) => {
    const product = productMap.get(item.product_id);
    if (!product || product.deleted_at || product.product_status !== "active" || product.is_visible_on_pos === false || product.is_published === false) return [];
    const stockRelation = product.inventory_stock as { current_quantity?: number } | Array<{ current_quantity?: number }> | null;
    const stock = Array.isArray(stockRelation) ? stockRelation[0] : stockRelation;
    return [{
      id: item.id,
      productId: product.id,
      name: product.product_name || "Product",
      imageUrl: product.image_url || product.image_path || null,
      quantity: item.quantity,
      unitPrice: Number(product.price ?? 0),
      stockAvailable: Number(stock?.current_quantity ?? 0)
    }];
  });
  const storeRelation = cart.stores as { name?: string } | Array<{ name?: string }> | null;
  const store = Array.isArray(storeRelation) ? storeRelation[0] : storeRelation;
  return {
    id: cart.id,
    storeId: cart.store_id,
    storeName: store?.name ?? null,
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)
  };
}

