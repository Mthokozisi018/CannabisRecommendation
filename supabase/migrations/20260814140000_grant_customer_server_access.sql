-- Customer API routes use the server-only Supabase service role. RLS remains
-- enabled for browser roles; these grants only make the tables reachable by
-- trusted server code through the Data API.

grant select, insert, update, delete
  on table
    public.customer_profiles,
    public.customer_addresses,
    public.customer_preferences,
    public.customer_favourites,
    public.customer_support_requests,
    public.customer_consents
  to service_role;
