begin;
alter table public.pos_sales
  add column refunded_amount numeric(12,2) not null default 0 check (refunded_amount >= 0 and refunded_amount <= total),
  add column amendment_version integer not null default 0,
  add column payment_provider text,
  add column customer_name_snapshot text,
  add column customer_phone_snapshot text;
alter table public.pos_sales add column refund_status text generated always as
  (case when refunded_amount = 0 then 'not_refunded' when refunded_amount = total then 'refunded' else 'partially_refunded' end) stored;
comment on column public.pos_sales.payment_provider is 'Set by the trusted payment integration for provider-linked sales. Manual corrections/refunds are blocked.';

create function public.snapshot_pos_customer() returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
begin
  select full_name, phone_display into new.customer_name_snapshot, new.customer_phone_snapshot
  from public.pos_customers where id = new.customer_id and store_id = new.store_id;
  return new;
end $$;
create trigger pos_customer_receipt_snapshot before insert on public.pos_sales
for each row execute function public.snapshot_pos_customer();

alter table public.pos_sale_items add column strain_snapshot text,
  add column cultivation_snapshot text, add column image_snapshot text;
create function public.snapshot_pos_product() returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
declare p jsonb;
begin
  select to_jsonb(products) into p from public.products where id = new.product_id;
  new.strain_snapshot := p->>'strain_type';
  new.cultivation_snapshot := p->>'cultivation_type';
  new.image_snapshot := p->>'image_url';
  return new;
end $$;
create trigger pos_product_receipt_snapshot before insert on public.pos_sale_items
for each row execute function public.snapshot_pos_product();

create table public.pos_sale_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  sale_id uuid not null references public.pos_sales(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  kind text not null check (kind in ('payment_correction','refund')),
  reason text not null check (length(trim(reason)) between 5 and 1000),
  actor_id uuid not null references auth.users(id),
  actor_name text not null,
  created_at timestamptz not null default now(),
  before_payment jsonb not null,
  after_payment jsonb not null,
  amount numeric(12,2) not null default 0 check (amount >= 0)
);
create index pos_sale_events_sale_idx on public.pos_sale_events(sale_id, created_at);
alter table public.pos_sale_events enable row level security;
revoke all on public.pos_sale_events from public, anon, authenticated, service_role;
grant select on public.pos_sale_events to authenticated;
grant select, insert on public.pos_sale_events to service_role;
create policy pos_sale_events_store_read on public.pos_sale_events for select to authenticated
using (public.is_store_member(store_id));

-- Invoker functions preserve the caller's store RLS. They never accept an actor ID.
create function public.get_pos_receipt(p_sale_id uuid, p_store_id uuid) returns jsonb
language sql stable security invoker set search_path = pg_catalog, public as $$
 select jsonb_build_object(
   'id', s.id, 'checkout_id', s.checkout_id, 'created_at', s.created_at,
   'subtotal', s.subtotal, 'total', s.total, 'payment_method', s.payment_method,
   'cash_amount', s.cash_amount, 'card_amount', s.card_amount,
   'refunded_amount', s.refunded_amount, 'refund_status', s.refund_status, 'version', s.amendment_version,
   'payment_provider', case when to_jsonb(s)->>'online_order_id' is not null then 'online_order' else s.payment_provider end,
   'customer', case when s.customer_name_snapshot is not null then jsonb_build_object('full_name',s.customer_name_snapshot,'phone_display',s.customer_phone_snapshot)
     else (select jsonb_build_object('full_name', c.full_name, 'phone_display', c.phone_display)
     from public.pos_customers c where c.id = s.customer_id and c.store_id = s.store_id) end,
   'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.pos_sale_items i where i.sale_id = s.id), '[]'::jsonb),
   'events', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'reason',e.reason,'actor_name',e.actor_name,'created_at',e.created_at,'before_payment',e.before_payment,'after_payment',e.after_payment,'amount',e.amount) order by e.created_at,e.id) from public.pos_sale_events e where e.sale_id = s.id), '[]'::jsonb)
 ) from public.pos_sales s where s.id = p_sale_id and s.store_id = p_store_id and s.status = 'completed';
$$;
revoke all on function public.get_pos_receipt(uuid,uuid) from public, anon;
grant execute on function public.get_pos_receipt(uuid,uuid) to authenticated, service_role;

create function public.search_pos_transactions(p_store_id uuid, p_search text default '', p_date date default null, p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
 select coalesce(jsonb_agg(public.get_pos_receipt(q.id,p_store_id) order by q.created_at desc,q.id), '[]'::jsonb)
 from (select s.id,s.created_at from public.pos_sales s
 left join public.pos_customers c on c.id = s.customer_id and c.store_id = s.store_id
 where s.store_id = p_store_id and s.status = 'completed'
 and (p_date is null or (s.created_at >= (p_date::timestamp at time zone 'Africa/Johannesburg') and s.created_at < ((p_date + 1)::timestamp at time zone 'Africa/Johannesburg')))
 and (coalesce(p_search,'') = '' or position(lower(left(p_search,100)) in lower(coalesce(s.customer_name_snapshot,'') || ' ' || coalesce(s.customer_phone_snapshot,'') || ' ' || coalesce(c.full_name,'') || ' ' || coalesce(c.phone_display,'') || ' ' || coalesce(c.phone_normalized,'') || ' ' || s.checkout_id::text || ' ' || s.id::text)) > 0
   or (length(regexp_replace(coalesce(p_search,''),'[^0-9]','','g')) >= 3
     and position(regexp_replace(p_search,'[^0-9]','','g') in
       regexp_replace(coalesce(s.customer_phone_snapshot,'') || ' ' || coalesce(c.phone_display,'') || ' ' || coalesce(c.phone_normalized,'') || ' ' || regexp_replace(coalesce(c.phone_normalized,''),'^\+27','0'),'[^0-9]','','g')) > 0))
 order by s.created_at desc,s.id limit 20 offset greatest(0,least(p_offset,200000))) q;
$$;
revoke all on function public.search_pos_transactions(uuid,text,date,integer) from public,anon;
grant execute on function public.search_pos_transactions(uuid,text,date,integer) to authenticated;

-- Service-only mutation: trusted server supplies the authenticated actor, checked again here.
create function public.amend_pos_transaction(p_sale_id uuid, p_actor_id uuid, p_request_id uuid,
 p_version integer, p_kind text, p_reason text, p_payment jsonb, p_returned_externally boolean)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare s public.pos_sales%rowtype; staff record; old_payment jsonb; saved_event public.pos_sale_events%rowtype;
 method text; cash numeric; card numeric; refund numeric := 0;
begin
 select sp.store_id, coalesce(nullif(to_jsonb(sp)->>'full_name',''), nullif(trim(concat_ws(' ',to_jsonb(sp)->>'first_name',to_jsonb(sp)->>'surname')),''), p_actor_id::text) as name
 into staff from public.staff_profiles sp join public.stores st on st.id = sp.store_id
 where coalesce(sp.auth_user_id,sp.user_id) = p_actor_id and sp.role in ('manager','receptionist')
 and coalesce(sp.account_status,case when sp.is_active then 'active' else 'deactivated' end) = 'active'
 and coalesce(st.store_access_status,case when st.is_active then 'active' else 'restricted' end) = 'active' limit 1;
 if staff.store_id is null then raise exception 'Transaction access denied.' using errcode='42501'; end if;
 select * into s from public.pos_sales where id=p_sale_id and store_id=staff.store_id and status='completed' for update;
 if s.id is null then raise exception 'Transaction access denied.' using errcode='42501'; end if;
 select * into saved_event from public.pos_sale_events where request_id=p_request_id;
 if found then
   if saved_event.sale_id=p_sale_id and saved_event.actor_id=p_actor_id and saved_event.kind=p_kind
      and saved_event.reason=trim(p_reason) and saved_event.after_payment=p_payment then return; end if;
   raise exception 'This request identifier has already been used.';
 end if;
 if p_version is null or s.amendment_version <> p_version then raise exception 'Transaction changed. Reload its details before trying again.'; end if;
 if s.payment_provider is not null or to_jsonb(s)->>'online_order_id' is not null then
   raise exception 'Provider reconciliation required. Use the payment provider refund or reconciliation process.';
 end if;
 if p_request_id is null or p_kind is null or p_kind not in ('payment_correction','refund') or p_reason is null or length(trim(p_reason)) not between 5 and 1000 then raise exception 'A valid action and reason are required.'; end if;
 old_payment := jsonb_build_object('method',s.payment_method,'cashAmount',s.cash_amount,'cardAmount',s.card_amount);
 if s.payment_method is null then raise exception 'Historical payment must be reconciled by the manager.'; end if;
 method := p_payment->>'method'; cash := (p_payment->>'cashAmount')::numeric; card := (p_payment->>'cardAmount')::numeric;
 if method is null or method not in ('cash','card','split') or cash is null or card is null
   or cash::text in ('NaN','Infinity','-Infinity') or card::text in ('NaN','Infinity','-Infinity')
   or cash < 0 or card < 0 or cash <> round(cash,2) or card <> round(card,2)
   or cash + card <> s.total or (method='cash' and card<>0) or (method='card' and cash<>0) then raise exception 'Invalid payment allocation.'; end if;
 if s.refunded_amount > 0 then raise exception 'This transaction has already been refunded. Further changes require reconciliation.'; end if;
 if p_kind='refund' then
   if p_returned_externally is distinct from true or p_payment <> old_payment then raise exception 'Confirm the original payment was returned externally.'; end if;
   refund := s.total;
   if refund <= 0 then raise exception 'No refundable balance remains.'; end if;
 else
   if p_payment = old_payment then raise exception 'Choose a different payment allocation.'; end if;
 end if;
 insert into public.pos_sale_events(request_id,sale_id,store_id,kind,reason,actor_id,actor_name,before_payment,after_payment,amount)
 values(p_request_id,s.id,s.store_id,p_kind,trim(p_reason),p_actor_id,staff.name,old_payment,p_payment,refund);
 update public.pos_sales set payment_method=method,cash_amount=cash,card_amount=card,
   refunded_amount=refund,amendment_version=amendment_version+1 where id=s.id;
 -- Deliberately no inventory mutation: returned stock is a separate physical process.
end $$;
revoke all on function public.amend_pos_transaction(uuid,uuid,uuid,integer,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.amend_pos_transaction(uuid,uuid,uuid,integer,text,text,jsonb,boolean) to service_role;
commit;
