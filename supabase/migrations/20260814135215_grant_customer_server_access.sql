
grant select, insert, update, delete
  on table
    public.customer_profiles,
    public.customer_addresses,
    public.customer_preferences,
    public.customer_favourites,
    public.customer_support_requests,
    public.customer_consents
  to service_role;
