insert into public.store_fulfillment_settings (store_id)
select id from public.stores
on conflict (store_id) do nothing;
