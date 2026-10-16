begin;
-- Match the existing product-image validation trigger's canonical layout.
alter policy demo_storage_read_boundary on storage.objects
using ((select private.demo_store_id()) is null or
  (bucket_id='product-images' and name like ('stores/' || (select private.demo_store_id())::text || '/products/%')));
commit;
