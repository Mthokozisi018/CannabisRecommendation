import "server-only";
import type { SupplySnapshot, SupplyDistribution } from "./data";
import { distributionTimestamp } from "./history-filters";

function safe(value: unknown) {
  return String(value ?? "—").normalize("NFKD").replace(/[^\x20-\x7e]/g," ").replace(/\s+/g," ").slice(0,110).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
}
export function buildSupplyHistoryPdf(rows: SupplyDistribution[], snapshot: SupplySnapshot) {
  const pages:string[][]=[]; let commands:string[]=[]; let y=780;
  const line=(value:unknown, size=9, bold=false)=>{commands.push(`BT /${bold?"F2":"F1"} ${size} Tf 0.10 0.19 0.14 rg 42 ${y} Td (${safe(value)}) Tj ET`);y-=size+6;};
  const newPage=()=>{if(commands.length)pages.push(commands);commands=[];y=780;line("GreenChoice | Master Supply Distribution History",16,true);line(`Generated ${new Intl.DateTimeFormat("en-ZA",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Johannesburg"}).format(new Date())}`,9);y-=10;};
  newPage();
  if(!rows.length) line("No distributions match these filters.");
  for(const row of rows) {
    const store=snapshot.stores.find(s=>s.id===row.store_id);
    const request=row.request_id?snapshot.requests.find(r=>r.id===row.request_id):null;
    const productLines=row.master_supply_distribution_items.map(i=>`${snapshot.products.find(p=>p.id===i.product_id)?.name??"Product"} | ${i.quantity} sent | ${i.received_quantity??"-"} received`);
    if(y < 130+productLines.length*18)newPage();
    line(`${store?.name??"Store"} | ${store?.city??""}, ${store?.province??""}`,12,true);
    line(`Date: ${new Intl.DateTimeFormat("en-ZA",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Johannesburg"}).format(new Date(distributionTimestamp(row)))} | Status: ${row.status} | Method: ${row.delivery_method}`);
    line(`Distributed by: ${snapshot.names[row.distributed_by]??"Franchise Admin"} | Received by: ${row.received_by?snapshot.names[row.received_by]??"Store Manager":"-"}`);
    line(`Request: ${request?.id??"No"} | Notes: ${row.notes||"-"}`);
    for(const product of productLines)line(`  ${product}`);
    y-=10;
  }
  pages.push(commands);
  const objects:string[]=["","<< /Type /Catalog /Pages 2 0 R >>","","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  const pageIds:number[]=[];
  for(const contentLines of pages){const content=contentLines.join("\n");const contentId=objects.push(`<< /Length ${Buffer.byteLength(content,"latin1")} >>\nstream\n${content}\nendstream`)-1;const pageId=objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`)-1;pageIds.push(pageId);}
  objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let output="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";const offsets=[0];
  for(let i=1;i<objects.length;i++){offsets[i]=Buffer.byteLength(output,"latin1");output+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(output,"latin1");output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let i=1;i<objects.length;i++)output+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  output+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output,"latin1");
}
