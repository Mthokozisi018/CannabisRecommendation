begin;

-- Keep relocatable extensions out of the API-exposed public schema. Existing
-- trigram indexes retain their operator-class OIDs when the extension moves.
alter extension pg_trgm set schema extensions;

-- Trigger functions are invoked by PostgreSQL and must not be exposed as RPCs.
revoke all on function public.set_inventory_row_store_id() from public, anon, authenticated;

-- The live customer-sales migration revoked this overload before the matching
-- customer-selection UI was deployed. The production workstation still calls
-- the secure, atomic three-argument overload. Restore it only for the backend
-- service role; browser roles retain no direct execution permission.
revoke all on function public.complete_receptionist_sale_v2(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_receptionist_sale_v2(uuid, uuid, jsonb)
  to service_role;

-- Pin application-owned helper and trigger functions to trusted schemas.
alter function public.touch_updated_at()
  set search_path = pg_catalog, public;

alter function public.greenchoice_is_whole_number(numeric)
  set search_path = pg_catalog, public;

alter function public.audit_events_immutable()
  set search_path = pg_catalog, public;

alter function public.products_search_tsv_update()
  set search_path = pg_catalog, public;

alter function public.reject_fractional_stock_audit_details()
  set search_path = pg_catalog, public;

commit;
