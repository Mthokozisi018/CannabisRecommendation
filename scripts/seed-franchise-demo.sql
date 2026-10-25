-- DEMONSTRATION DATA ONLY. Execute exclusively on GreenChoice Staging:
-- jezbvjepxosphdrykrcg. Never run on production.
-- Fixed dataset: 2026-07-15 through 2026-10-12, Africa/Johannesburg.
-- Stable IDs are MD5(namespace/entity/key)::uuid; existing rows are never updated.
-- Removal must use these exact IDs, child records first, after checking that
-- no legitimate records have subsequently been attached to these demo stores.
begin;
do $demo$
declare
  ns constant text := 'greenchoice-franchise-demo-v1:ec7730b6-27b2-4d86-8ba6-16c387060831:';
  fid constant uuid := 'ec7730b6-27b2-4d86-8ba6-16c387060831';
  actor uuid;
  names text[] := array['Pretoria Central Branch','Menlyn Branch','Centurion Branch','Hatfield Branch','Midrand Branch'];
  slugs text[] := array['pretoria-central','menlyn','centurion','hatfield','midrand'];
  locations text[] := array['Pretoria CBD','Menlyn, Pretoria','Centurion','Hatfield, Pretoria','Midrand'];
  targets numeric[] := array[85000,145000,110000,65000,125000];
  expected_baskets numeric[] := array[378,497,426,308,449];
  extra_line_chances numeric[] := array[0.6,1.1,0.8,0.3,0.9];
  customer_counts integer[] := array[105,170,135,85,150];
  product_names text[] := array['Demo Citrus Flower','Demo Berry Gummies','Demo Sparkling Citrus','Demo Evening Pre-Rolls','Demo Storage Kit','Demo Citrus Cartridge','Demo Citrus Concentrate'];
  cats text[] := array['Flower','Edibles','Beverages','Pre-Rolls','Accessories','Vape Cartridges','Concentrates'];
  cat_slugs text[] := array['flower','edibles','beverages','pre-rolls','accessories','vape-cartridges','concentrates'];
  subcats text[] := array['Indoor','Gummies','Sparkling','Multi-pack','Storage','Cartridges','Wax'];
  prices numeric[] := array[95,145,75,195,180,360,390];
  s integer; c integer; p integer; d integer; tx integer; ln integer;
  sid uuid; cid uuid; pid uuid; saleid uuid; itemid uuid; categoryid uuid;
  day date; ts timestamptz; key text; phone text;
  u numeric; variation numeric; day_count integer; lines integer; qty integer;
  total_amount numeric; cash numeric; method text;
begin
  perform pg_advisory_xact_lock(hashtextextended(ns,0));
  select u.id into actor from auth.users u join public.staff_profiles sp on sp.auth_user_id=u.id
  join public.franchises f on f.id=sp.franchise_id
  where lower(u.email)='franchise.admin@example.com' and sp.role='franchise_admin'
    and sp.franchise_id=fid and sp.account_status='active';
  if actor is distinct from 'd1455363-b2ac-404b-918f-f6b56c69416f'::uuid then
    raise exception 'Existing target account/franchise association is missing or changed';
  end if;
  for s in 1..5 loop
    sid := md5(ns||'store:'||s)::uuid;
    if exists(select 1 from public.stores where slug='gc-demo-fa-v1-'||slugs[s] and id<>sid) then
      raise exception 'Demo slug collision; refusing to change existing store';
    end if;
    if exists(select 1 from public.stores where id=sid and
      (franchise_id is distinct from fid or slug<>'gc-demo-fa-v1-'||slugs[s]
       or public_description is distinct from 'Fictional demonstration store. Dataset greenchoice-franchise-demo-v1. Location: '||locations[s])) then
      raise exception 'Demo store identity collision';
    end if;
    insert into public.stores(id,slug,name,franchise_id,is_active,store_access_status,
      address,store_address,physical_store_address,city,province,postal_code,
      store_contact_email,store_phone_number,public_description,opening_hours,created_at,updated_at)
    values(sid,'gc-demo-fa-v1-'||slugs[s],names[s],fid,true,'active',
      'Fictional Demo Retail Centre, Unit '||s||', '||locations[s],
      'Fictional Demo Retail Centre, Unit '||s||', '||locations[s],
      'Fictional Demo Retail Centre, Unit '||s||', '||locations[s],
      case when s=3 then 'Centurion' when s=5 then 'Midrand' else 'Pretoria' end,
      'Gauteng',(array['0002','0181','0157','0083','1685'])[s],
      slugs[s]||'@franchise-demo.example.com','DEMO - no telephone service',
      'Fictional demonstration store. Dataset greenchoice-franchise-demo-v1. Location: '||locations[s],
      '{"monday":{"open":"09:00","close":"18:00"},"tuesday":{"open":"09:00","close":"18:00"},"wednesday":{"open":"09:00","close":"18:00"},"thursday":{"open":"09:00","close":"18:00"},"friday":{"open":"09:00","close":"18:00"},"saturday":{"open":"09:00","close":"17:00"},"sunday":{"open":"10:00","close":"15:00"}}'::jsonb,
      '2026-06-01 09:00+02'::timestamptz+s*interval '3 days','2026-07-14 09:00+02')
    on conflict(id) do nothing;
    for c in 1..customer_counts[s] loop
      cid := md5(ns||'customer:'||s||':'||c)::uuid;
      phone := '060'||lpad((s*10000+c)::text,7,'0');
      insert into public.pos_customers(id,store_id,first_name,surname,full_name,
        phone_normalized,phone_digits,phone_display,created_at,updated_at)
      values(cid,sid,'Demo '||(array['Alex','Sam','Jamie','Taylor','Morgan','Casey','Robin'])[1+(c%7)],
        'Customer '||s||'-'||lpad(c::text,3,'0'),
        'Demo '||(array['Alex','Sam','Jamie','Taylor','Morgan','Casey','Robin'])[1+(c%7)]||' Customer '||s||'-'||lpad(c::text,3,'0'),
        '+27'||substring(phone from 2),phone,'FICTIONAL DEMO: '||phone,
        '2026-07-14 09:00+02','2026-07-14 09:00+02') on conflict(id) do nothing;
      if not exists(select 1 from public.pos_customers where id=cid and store_id=sid and phone_digits=phone) then
        raise exception 'Demo customer identity collision';
      end if;
    end loop;
    for p in 1..7 loop
      pid := md5(ns||'product:'||s||':'||p)::uuid;
      select id into strict categoryid from public.categories where slug=cat_slugs[p];
      insert into public.products(id,store_id,category_id,subcategory_slug,slug,name,
        product_name,category,subcategory,cultivation_type,price_cents,price,
        description,brand,product_status,is_published,is_visible_on_pos,created_at,updated_at)
      values(pid,sid,categoryid,lower(replace(subcats[p],' ','-')),
        'gc-demo-fa-v1-'||slugs[s]||'-product-'||p,product_names[p],product_names[p],cats[p],subcats[p],
        case when p in (1,4) then 'Indoor' when p=6 then 'Hybrid' else null end,
        prices[p]*100,prices[p],'Fictional demonstration product. Dataset greenchoice-franchise-demo-v1.',
        'GreenChoice Fictional Demo','active',false,false,'2026-07-14 09:00+02','2026-07-14 09:00+02')
      on conflict(id) do nothing;
      if not exists(select 1 from public.products where id=pid and store_id=sid and name=product_names[p]) then
        raise exception 'Demo product identity collision';
      end if;
    end loop;
    for d in 0..89 loop
      day := date '2026-07-15'+d;
      key := ns||'day:'||s||':'||day;
      u := ('x'||substring(md5(key),1,8))::bit(32)::bigint/4294967295.0;
      variation := (0.66+u*0.68)
        *case when extract(isodow from day) in (6,7) then 1.22 else 0.91 end
        *case when extract(day from day)>=25 or extract(day from day)<=3 then 1.12 else 0.96 end
        *case when extract(month from day)=7 then 0.93 when extract(month from day)=8 then 0.98 when extract(month from day)=9 then 1.03 else 1.08 end;
      day_count := greatest(2,round(targets[s]/30.44/expected_baskets[s]*variation)::integer);
      for tx in 1..day_count loop
        key := ns||'sale:'||s||':'||day||':'||tx;
        saleid := md5(key)::uuid;
        cid := md5(ns||'customer:'||s||':'||(1+((d*17+tx*11)%customer_counts[s])))::uuid;
        -- Only elapsed times today; all timestamps are explicit Johannesburg times.
        ts := (day+time '09:00') at time zone 'Africa/Johannesburg'
          +((tx-1)*360.0/day_count)::integer*interval '1 minute';
        if day=date '2026-10-12' then ts:= (day+time '00:05') at time zone 'Africa/Johannesburg'+tx*interval '1 minute'; end if;
        u := ('x'||substring(md5(key||':lines'),1,8))::bit(32)::bigint/4294967295.0;
        lines := 1+floor(extra_line_chances[s])::integer
          +case when u<(extra_line_chances[s]-floor(extra_line_chances[s])) then 1 else 0 end;
        total_amount := 0;
        for ln in 1..lines loop
          p := 1+(('x'||substring(md5(key||':product:'||ln),1,8))::bit(32)::bigint%7)::integer;
          qty := case when ('x'||substring(md5(key||':qty:'||ln),1,8))::bit(32)::bigint%100<15 then 2 else 1 end;
          total_amount := total_amount+prices[p]*qty;
        end loop;
        method := case when tx%10=0 then 'split' when tx%3=0 then 'cash' else 'card' end;
        cash := case method when 'split' then round(total_amount*0.4,2) when 'cash' then total_amount else 0 end;
        insert into public.pos_sales(id,store_id,checkout_id,customer_id,status,subtotal,total,
          sale_source,payment_method,payment_status,cash_amount,card_amount,created_at)
        values(saleid,sid,md5(key||':checkout')::uuid,cid,'completed',total_amount,total_amount,
          'pos',method,'paid',cash,total_amount-cash,ts) on conflict(id) do nothing;
        if not exists(select 1 from public.pos_sales where id=saleid and store_id=sid
          and checkout_id=md5(key||':checkout')::uuid and total=total_amount and created_at=ts) then
          raise exception 'Demo sale identity collision';
        end if;
        for ln in 1..lines loop
          p := 1+(('x'||substring(md5(key||':product:'||ln),1,8))::bit(32)::bigint%7)::integer;
          qty := case when ('x'||substring(md5(key||':qty:'||ln),1,8))::bit(32)::bigint%100<15 then 2 else 1 end;
          pid := md5(ns||'product:'||s||':'||p)::uuid;
          itemid := md5(key||':item:'||ln)::uuid;
          insert into public.pos_sale_items(id,sale_id,product_id,product_name_snapshot,category_snapshot,
            subcategory_snapshot,unit_price,quantity,line_total,created_at)
          values(itemid,saleid,pid,product_names[p],cats[p],subcats[p],prices[p],qty,prices[p]*qty,ts)
          on conflict(id) do nothing;
          if not exists(select 1 from public.pos_sale_items where id=itemid and sale_id=saleid and product_id=pid
            and quantity=qty and unit_price=prices[p] and line_total=prices[p]*qty) then
            raise exception 'Demo line item identity collision';
          end if;
        end loop;
      end loop;
    end loop;
  end loop;
  if exists(select 1 from public.pos_sales ps join public.stores st on st.id=ps.store_id
    where st.slug like 'gc-demo-fa-v1-%' and (ps.total<>(select sum(line_total) from public.pos_sale_items where sale_id=ps.id)
      or exists(select 1 from public.pos_sale_items i join public.products p on p.id=i.product_id where i.sale_id=ps.id and p.store_id<>ps.store_id)
      or not exists(select 1 from public.pos_customers c where c.id=ps.customer_id and c.store_id=ps.store_id))) then
    raise exception 'Demo reconciliation failed; rolling back';
  end if;
end;
$demo$;
select st.id,st.name,count(ps.id) as transactions,sum(ps.total) as revenue,
  round(avg(ps.total),2) as average_transaction,
  sum(ps.total) filter(where ps.created_at>='2026-09-01 00:00+02' and ps.created_at<'2026-10-01 00:00+02') as september_revenue
from public.stores st join public.pos_sales ps on ps.store_id=st.id
where st.franchise_id='ec7730b6-27b2-4d86-8ba6-16c387060831' and st.slug like 'gc-demo-fa-v1-%'
group by st.id,st.name order by st.name;
commit;
