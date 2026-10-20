import { z } from "zod";
import { requireFranchiseAdmin } from "@/lib/franchise/auth";
import { getFranchiseSupplySnapshot } from "@/lib/master-supply/data";
import { buildSupplyHistoryPdf } from "@/lib/master-supply/history-pdf";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { datePartsInTimeZone } from "@/lib/manager/report-calendar";

export const dynamic = "force-dynamic";
const schema=z.object({search:z.string().max(100),storeId:z.union([z.string().uuid(),z.literal("")]),status:z.string().max(30),from:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/)}).strict();
export async function POST(request:Request) {
  try {
    await verifyOrigin();
    const { session }=await requireFranchiseAdmin();
    await assertRateLimit(`master-supply-pdf:${session.authUserId}`,8,60_000);
    const filters=schema.parse(await request.json());
    const snapshot=await getFranchiseSupplySnapshot("history");
    const stores=new Map(snapshot.stores.map(s=>[s.id,s]));const products=new Map(snapshot.products.map(p=>[p.id,p]));
    const rows=snapshot.distributions.filter(d=>{
      const store=stores.get(d.store_id);
      const productNames=d.master_supply_distribution_items.map(i=>products.get(i.product_id)?.name).join(" ");
      const parts=datePartsInTimeZone(new Date(d.created_at));const date=`${parts.year}-${String(parts.month).padStart(2,"0")}-${String(parts.day).padStart(2,"0")}`;
      return (!filters.storeId||d.store_id===filters.storeId)&&(!filters.status||d.status===filters.status)&&(!filters.from||date>=filters.from)&&(!filters.to||date<=filters.to)&&(!filters.search||`${store?.name} ${store?.city} ${productNames}`.toLowerCase().includes(filters.search.toLowerCase()));
    });
    return new Response(buildSupplyHistoryPdf(rows,snapshot),{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=greenchoice-master-supply-history.pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch {
    return Response.json({error:"Distribution history could not be exported."},{status:400,headers:{"Cache-Control":"private, no-store"}});
  }
}
