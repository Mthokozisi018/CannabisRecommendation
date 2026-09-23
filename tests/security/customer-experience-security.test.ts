import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260830180538_customer_experience_rebuild.sql",
  ),
  "utf8",
);
const storeImageMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260830180541_storefront_images.sql"),
  "utf8",
);

describe("customer experience security and lifecycle", () => {
  it("keeps all trusted order and history mutations service-only", () => {
    expect(migration).toContain(
      "revoke all on function public.place_customer_order_v2(uuid, uuid, text, jsonb, text, uuid) from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.place_customer_order_v2(uuid, uuid, text, jsonb, text, uuid) to service_role",
    );
    expect(migration).toContain(
      "revoke all on function public.cancel_customer_order(uuid, uuid, text) from public, anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all on function public.advance_customer_order(uuid, uuid, text) from public, anon, authenticated",
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.(?:place_customer_order_v2|cancel_customer_order|advance_customer_order)[^;]*authenticated/i,
    );
  });

  it("enforces ownership and store isolation through RLS", () => {
    expect(migration).toContain("customer_store_views_self_all");
    expect(migration).toContain("(select auth.uid()) = user_id");
    expect(migration).toContain("order_fulfillment_customer_read");
    expect(migration).toContain("delivery_tracking_customer_read");
    expect(migration).toContain("payment_transactions_customer_read");
    expect(migration).toContain("public.is_store_member(o.store_id)");
  });

  it("locks checkout, derives prices, and makes retries idempotent", () => {
    expect(migration).toContain("orders_customer_idempotency_uidx");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("for update of c");
    expect(migration).toContain("v_product.price * v_item.quantity");
    expect(migration).toContain(
      "reserved_quantity = reserved_quantity + v_item.quantity",
    );
    expect(migration).not.toContain("p_total numeric");
  });

  it("uses real fulfillment controls, geospatial storage, and dated order numbers", () => {
    expect(migration).toContain("create extension if not exists postgis");
    expect(migration).toContain("orders_enabled boolean not null default true");
    expect(migration).toContain("if not v_orders_enabled then");
    expect(migration).toContain("'GC-' || to_char(clock_timestamp()");
    expect(migration).toContain("'YYMMDD'");
    expect(migration).toContain("stores_customer_location_gist_idx");
  });

  it("enforces the four-day collection window in the database", () => {
    expect(migration).toContain("now() + interval '4 days'");
    expect(migration).toContain("now() < v_order.collection_expires_at");
    expect(migration).toContain("Collection order has not expired.");
    expect(migration).toContain("Expired collection order released");
    expect(migration).toContain(
      "reserved_quantity = reserved_quantity - v_item.quantity",
    );
  });

  it("keeps storefront image storage scoped to uploaded store covers only", () => {
    expect(storeImageMigration).toContain("values ('store-images', 'store-images', true");
    expect(storeImageMigration).toContain("add column if not exists store_image_url text");
    expect(storeImageMigration).toContain("create trigger stores_validate_store_image_reference");
    expect(storeImageMigration).toContain("add column if not exists storage_bucket text");
    expect(storeImageMigration).toContain("add column if not exists storage_path text");
    expect(storeImageMigration).toContain("format('stores/%s/cover/', new.id)");
    expect(storeImageMigration).toContain("format('stores/%s/cover/', new.store_id)");
    expect(storeImageMigration).toContain("invalid_store_image_reference");
    expect(storeImageMigration).toContain("new.store_image_url like '%store-image-coming-soon.png%'");
  });
});
