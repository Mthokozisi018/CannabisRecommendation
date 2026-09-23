import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("pending customer order security contracts", () => {
  const migrationPath = "supabase/migrations/20260830180536_pending_online_orders.sql";

  it("creates customer-owned and store-isolated read policies", () => {
    const migration = source(migrationPath);
    expect(migration).toContain("customer_id = (select auth.uid())");
    expect(migration).toContain("private.is_active_customer()");
    expect(migration).toContain("public.is_store_member(store_id)");
    expect(migration).toContain("public.is_store_member(o.store_id)");
    expect(migration).toContain("revoke all on table public.orders, public.order_items from anon, authenticated");
    expect(migration).toContain("grant select on table public.orders, public.order_items to authenticated");
  });

  it("keeps order mutations service-only and server-identity bound", () => {
    const migration = source(migrationPath);
    const customerAction = source("app/customer/actions.ts");
    const managerAction = source("app/dashboard/manager/orders/actions.ts");
    expect(migration).toContain("grant execute on function public.place_customer_collection_order(uuid, uuid, text) to service_role");
    expect(migration).toContain("grant execute on function public.confirm_customer_collection_order(uuid, uuid) to service_role");
    expect(migration).toContain("grant execute on function public.forfeit_customer_collection_order(uuid, uuid) to service_role");
    expect(migration).not.toMatch(/grant execute on function public\.(?:place|confirm|forfeit)_customer_collection_order[^;]*to authenticated/i);
    expect(customerAction).toContain("p_customer_user_id: session.user.id");
    expect(managerAction).toContain("p_actor_user_id: session.authUserId");
    expect(managerAction).toContain("order.store_id !== session.assignedStoreId");
  });

  it("locks state and updates inventory, sales, movements, and audits atomically", () => {
    const migration = source(migrationPath);
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(p_cart_id::text, 0))");
    expect(migration).toMatch(/from public\.orders where id = p_order_id for update/g);
    expect(migration).toContain("where id = v_order.id and status = 'pending'");
    expect(migration).toContain("reserved_quantity = reserved_quantity + v_item.quantity");
    expect(migration).toContain("reserved_quantity = reserved_quantity - v_item.quantity");
    expect(migration).toContain("current_quantity = current_quantity + v_item.quantity");
    expect(migration).toContain("'online_order', v_order.id");
    expect(migration).toContain("pos_sales_online_order_uidx");
    expect(migration).toContain("manager_confirmed_customer_order");
    expect(migration).toContain("manager_forfeited_customer_order");
  });

  it("re-reads store, product price, and stock instead of trusting browser totals", () => {
    const migration = source(migrationPath);
    expect(migration).toContain("where p.id = v_item.product_id");
    expect(migration).toContain("s.product_id = v_product.id and s.store_id = v_cart.store_id");
    expect(migration).toContain("round(v_product.price * 100)::integer <> v_item.unit_price_cents");
    expect(migration).toContain("v_product.price * v_item.quantity");
    expect(migration).toContain("v_stock.current_quantity < v_item.quantity");
    expect(migration).not.toContain("p_total");
    expect(migration).not.toContain("p_unit_price");
  });
});
