// Operator-only provisioning preparation. Run only after deploying demo guards.
// Credentials and generated SQL are written outside the repository; never logged.
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";

const output = resolve(process.argv[2] || "");
if (!process.argv[2] || (!relative(process.cwd(), output).startsWith("..") && !isAbsolute(relative(process.cwd(), output)))) throw Error("Provide a private output directory outside the repository.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (url !== "https://nfrvbnthsmlyqzmvqylh.supabase.co") throw Error("This task targets the verified production project only.");
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw Error("A production administrator key is required.");
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const sourceStore = "f7c8d6c9-64e9-4dca-a8f4-e5d0506fb5ba";
await mkdir(output, { recursive: true });
const journalPath = resolve(output, "provisioning.json");
let journal;
try { journal = JSON.parse(await readFile(journalPath,"utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
const save = () => writeFile(journalPath, JSON.stringify(journal,null,2), { mode: 0o600 });
if (!journal) {
  journal = { email: "demo@gc.example", password: `Gc!${randomBytes(15).toString("base64url")}9`, storeId: randomUUID(), products: [], copiedImages: [] };
  await save();
}
const { data: source, error: sourceError } = await admin.from("products").select("id,image_bucket,image_path,image_url").eq("store_id",sourceStore).is("deleted_at",null).order("id");
if (sourceError) throw Error(sourceError.message);
if (source.length !== 59) throw Error("Source inventory changed; inspect before proceeding.");
if (!journal.products.length) {
  journal.products = source.map(p => {
    const id = randomUUID();
    const path = p.image_path || (p.image_url ? decodeURIComponent(new URL(p.image_url).pathname.split("/product-images/")[1] || "") : null);
    if (path && p.image_bucket && p.image_bucket !== "product-images") throw Error("Unexpected source image bucket.");
    return { sourceId:p.id, id, sourcePath:path, imagePath:path ? `${journal.storeId}/products/${id}/${path.split("/").pop()}` : null };
  });
  await save();
}
if (!journal.authUserId) {
  const { data, error } = await admin.auth.admin.createUser({ email:journal.email, password:journal.password, email_confirm:true,
    app_metadata:{ greenchoice_demo_view_only:true }, user_metadata:{ full_name:"GreenChoice Demo" } });
  if (error) throw Error(error.message);
  journal.authUserId = data.user.id;
  await save();
}
for (const product of journal.products.filter(p => p.imagePath)) {
  if (journal.copiedImages.includes(product.imagePath)) continue;
  const bucket = admin.storage.from("product-images");
  const { error } = await bucket.copy(product.sourcePath,product.imagePath);
  if (error) throw Error(`Image copy failed: ${error.message}`);
  const [a,b] = await Promise.all([bucket.download(product.sourcePath),bucket.download(product.imagePath)]);
  if (a.error || b.error) throw Error("Could not verify independent image copy.");
  const hash = async blob => createHash("sha256").update(Buffer.from(await blob.arrayBuffer())).digest("hex");
  if (await hash(a.data) !== await hash(b.data)) throw Error("Image copy content mismatch.");
  journal.copiedImages.push(product.imagePath);
  await save();
}
const literal = s => `'${s.replaceAll("'","''")}'`;
const mapping = journal.products.map(p => ({ source_id:p.sourceId,id:p.id,image_path:p.imagePath,image_url:p.imagePath ? `${url}/storage/v1/object/public/product-images/${p.imagePath}` : null }));
const productColumns = "category_id,subcategory_slug,name,brand,strain_type,grow_type,genetics_summary,best_time_of_use,description,size_label,price_cents,rating_avg,rating_count,thc_value,thc_unit,cbd_value,cbd_unit,terpene_total_pct,is_lab_tested,is_on_special,is_new,is_published,stock_status,facet_values,product_name,category,subcategory,cultivation_type,price,product_status,thc_per_unit_mg,thc_per_packet_mg,is_visible_on_pos".split(",");
const sql = `begin;
create temporary table demo_product_mapping on commit drop as select * from jsonb_to_recordset(${literal(JSON.stringify(mapping))}::jsonb) as m(source_id uuid,id uuid,image_path text,image_url text);
insert into public.stores(id,slug,name,is_active,store_access_status,created_by_manager_id,store_information_confirmed_at,store_information_confirmed_by)
values ('${journal.storeId}','greenchoice-view-only-demo','GreenChoice Demo',true,'active','${journal.authUserId}',now(),'${journal.authUserId}');
insert into public.staff_profiles(auth_user_id,user_id,email,full_name,first_name,surname,role,is_active,account_status,store_id,account_setup_complete,profile_setup_complete,store_setup_complete,onboarding_completed_at,onboarding_complete_seen_at,temporary_password_active)
values ('${journal.authUserId}','${journal.authUserId}',${literal(journal.email)},'GreenChoice Demo','GreenChoice','Demo','manager',true,'active','${journal.storeId}',false,false,true,now(),now(),false);
insert into public.store_memberships(store_id,user_id,role) values ('${journal.storeId}','${journal.authUserId}','catalog_manager');
insert into private.demo_accounts(auth_user_id,store_id,source_store_id,snapshot_summary) values ('${journal.authUserId}','${journal.storeId}','${sourceStore}',jsonb_build_object('products',59,'images',28,'syntheticSales',12));
insert into public.products(id,store_id,slug,created_by,image_bucket,image_path,image_url,${productColumns.join(",")})
select m.id,'${journal.storeId}','demo-'||m.id,'${journal.authUserId}',case when m.image_path is not null then 'product-images' end,m.image_path,m.image_url,${productColumns.map(c=>`p.${c}`).join(",")}
from public.products p join demo_product_mapping m on m.source_id=p.id where p.store_id='${sourceStore}' and p.deleted_at is null;
insert into public.inventory_stock(product_id,store_id,current_quantity,low_stock_threshold,reserved_quantity)
select m.id,'${journal.storeId}',s.current_quantity,s.low_stock_threshold,0 from public.inventory_stock s join demo_product_mapping m on m.source_id=s.product_id where s.store_id='${sourceStore}';
-- Synthetic historical sales only: no original customers or sales are copied,
-- and snapshot stock quantities are never decremented by this fixture.
with fixtures as (
 select gen_random_uuid() id, gen_random_uuid() checkout_id,p.id product_id,p.product_name,p.category,p.subcategory,p.price,
 now()-((n-1)*interval '2 days') created_at,1+(n%3) quantity
 from generate_series(1,12) n cross join lateral (select * from public.products where store_id='${journal.storeId}' and price>0 order by id offset ((n-1)%10) limit 1) p
), sales as (
 insert into public.pos_sales(id,checkout_id,store_id,staff_user_id,status,subtotal,total,created_at,payment_method,cash_amount,card_amount)
 select id,checkout_id,'${journal.storeId}','${journal.authUserId}','completed',price*quantity,price*quantity,created_at,'card',0,price*quantity from fixtures returning id
)
insert into public.pos_sale_items(sale_id,product_id,product_name_snapshot,category_snapshot,subcategory_snapshot,unit_price,quantity,line_total,created_at)
select f.id,f.product_id,f.product_name,f.category,f.subcategory,f.price,f.quantity,f.price*f.quantity,f.created_at from fixtures f join sales s on s.id=f.id;
insert into public.audit_logs(user_id,action,table_name,record_id,store_id,result,details)
values ('${journal.authUserId}','production_read_only_demo_provisioned','stores','${journal.storeId}','${journal.storeId}','success',jsonb_build_object('independentSnapshot',true,'products',59,'images',28,'syntheticSales',12,'copiedPersonalData',false));
commit;`;
await writeFile(resolve(output,"snapshot.sql"),sql,{mode:0o600});
console.log(JSON.stringify({ authUserId:journal.authUserId,storeId:journal.storeId,products:journal.products.length,verifiedIndependentImages:journal.copiedImages.length,sqlPrepared:true }));
