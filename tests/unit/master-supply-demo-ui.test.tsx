import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
import { MasterSupplyPage } from "@/components/master-supply/MasterSupplyPage";
import { createSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import type { SupplyStore } from "@/lib/master-supply/data";

it("renders the demo overview with the dashboard Back link and all supply destinations",()=>{
  const store:SupplyStore={id:"00000000-0000-4000-8000-000000000001",name:"GreenChoice Test Store",city:"Pretoria",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"active"};
  const snapshot=createSupplyDemoSnapshot("franchise","actor",[store],new Date("2026-10-19T12:00:00Z"));
  const html=renderToStaticMarkup(<MasterSupplyPage mode="overview" snapshot={snapshot}/>);
  expect(html).toContain('href="/dashboard/franchise"');
  expect(html).toContain("Back</a>");
  expect(html).toContain('aria-label="Master Supply Management"');
  expect(html).toContain("/images/franchise/master-supply-management-heading.png");
  expect(html).not.toContain("<h1>Master Supply Management</h1>");
  for(const route of ["inventory","distribute","history","requests"]) expect(html).toContain(`href="/dashboard/franchise/supply/${route}"`);
  expect(html).toContain("GreenChoice Test Store");
  expect(html).not.toContain("Store-specific supply management");
  expect(html).not.toContain("Demo Updates");
});

it("uses the supplied artwork as the Supply Requests page heading",()=>{
  const store:SupplyStore={id:"00000000-0000-4000-8000-000000000001",name:"GreenChoice Test Store",city:"Pretoria",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"active"};
  const snapshot=createSupplyDemoSnapshot("franchise","actor",[store],new Date("2026-10-19T12:00:00Z"));
  const html=renderToStaticMarkup(<MasterSupplyPage mode="requests" snapshot={snapshot}/>);
  expect(html).toContain('aria-label="Supply Requests"');
  expect(html).toContain("/images/franchise/supply-requests-heading.png");
  expect(html).toContain("Back to Master Supply Management");
  expect(html).not.toContain("<h1>Supply Requests</h1>");
});

it("uses the supplied artwork as the Distribution History heading and keeps PDF export",()=>{
  const store:SupplyStore={id:"00000000-0000-4000-8000-000000000001",name:"GreenChoice Test Store",city:"Pretoria",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"active"};
  const snapshot=createSupplyDemoSnapshot("franchise","actor",[store],new Date("2026-10-19T12:00:00Z"));
  const html=renderToStaticMarkup(<MasterSupplyPage mode="history" snapshot={snapshot}/>);
  expect(html).toContain('aria-label="Distribution History"');
  expect(html).toContain("/images/franchise/distribution-history-heading.png");
  expect(html).toContain("Export to PDF");
  expect(html).not.toContain("<h1>Distribution History</h1>");
});

it("uses the supplied artwork as the Master Inventory heading and keeps Add Supply",()=>{
  const store:SupplyStore={id:"00000000-0000-4000-8000-000000000001",name:"GreenChoice Test Store",city:"Pretoria",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"active"};
  const snapshot=createSupplyDemoSnapshot("franchise","actor",[store],new Date("2026-10-19T12:00:00Z"));
  const html=renderToStaticMarkup(<MasterSupplyPage mode="inventory" snapshot={snapshot}/>);
  expect(html).toContain('aria-label="Master Inventory"');
  expect(html).toContain("/images/franchise/master-inventory-heading.png");
  expect(html).toContain("Add Supply");
  expect(html).not.toContain("<h1>Master Inventory</h1>");
});

it("uses the supplied artwork as the Distribute Supply heading",()=>{
  const store:SupplyStore={id:"00000000-0000-4000-8000-000000000001",name:"GreenChoice Test Store",city:"Pretoria",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"active"};
  const snapshot=createSupplyDemoSnapshot("franchise","actor",[store],new Date("2026-10-19T12:00:00Z"));
  const html=renderToStaticMarkup(<MasterSupplyPage mode="distribute" snapshot={snapshot}/>);
  expect(html).toContain('aria-label="Distribute Supply"');
  expect(html).toContain("/images/franchise/distribute-supply-heading.png");
  expect(html).toContain("Select Store");
  expect(html).not.toContain("<h1>Distribute Supply</h1>");
});

it("uses the supplied artwork above the individual Store Supply Performance dashboard",()=>{
  const store:SupplyStore={id:"00000000-0000-4000-8000-000000000001",name:"GreenChoice Test Store",city:"Pretoria",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"active",created_at:"2026-01-01T12:00:00Z"};
  const snapshot=createSupplyDemoSnapshot("franchise","actor",[store],new Date("2026-10-19T12:00:00Z"));
  snapshot.storeId=store.id;
  const html=renderToStaticMarkup(<MasterSupplyPage mode="store" snapshot={snapshot}/>);
  expect(html).toContain('aria-label="Supply Performance"');
  expect(html).toContain("/images/franchise/supply-performance-heading.png");
  expect(html).toContain("Back to Master Supply Management");
  expect(html).toContain("GreenChoice Test Store");
  expect(html).not.toContain("<h1>Store Master Supply</h1>");
});
