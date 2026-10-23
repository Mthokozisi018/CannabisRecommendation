import { z } from "zod";
import { requireFranchiseAdmin } from "@/lib/franchise/auth";
import { getFranchiseSupplySnapshot } from "@/lib/master-supply/data";
import { buildSupplyHistoryPdf } from "@/lib/master-supply/history-pdf";
import { filterSupplyHistory } from "@/lib/master-supply/history-filters";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";
const schema=z.object({search:z.string().max(100),storeId:z.union([z.string().uuid(),z.literal("")]),status:z.string().max(30),from:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/)}).strict();
export async function POST(request:Request) {
  try {
    await verifyOrigin();
    const { session }=await requireFranchiseAdmin();
    await assertRateLimit(`master-supply-pdf:${session.authUserId}`,8,60_000);
    const filters=schema.parse(await request.json());
    const snapshot=await getFranchiseSupplySnapshot("history");
    const rows=filterSupplyHistory(snapshot,{...filters,period:filters.from||filters.to?"custom":"all_time"});
    return new Response(buildSupplyHistoryPdf(rows,snapshot),{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=greenchoice-master-supply-history.pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch {
    return Response.json({error:"Distribution history could not be exported."},{status:400,headers:{"Cache-Control":"private, no-store"}});
  }
}
