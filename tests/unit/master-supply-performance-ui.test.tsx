// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("server-only",()=>({}));
import { createSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import { SupplyStoreDetail, supplyChartMoney, supplyTrendTick } from "@/components/master-supply/SupplyStoreDetail";
import type { SupplyStore } from "@/lib/master-supply/data";

afterEach(cleanup);
const chartLabels=(plot:HTMLElement)=>[...plot.querySelectorAll('text[class*="valueLabel"]')].map(node=>node.textContent);
const store:SupplyStore={id:"00000000-0000-4000-8000-000000000001",name:"Centurion Branch",city:"Centurion",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"active",physical_store_address:"Main Road",postal_code:"0157",store_phone_number:"012 555 0100",store_contact_email:"centurion@example.com",created_at:"2026-01-01T12:00:00Z"};
const demoSnapshot=()=>{const snapshot=createSupplyDemoSnapshot("franchise","actor",[store],new Date());snapshot.storeId=store.id;return snapshot;};
it("shows exact Rand values above every revenue point and category bar across intervals and fullscreen",()=>{
 expect([0,150,1500,25450.5].map(supplyChartMoney)).toEqual(["R0","R150","R1,500","R25,450.5"]);
 render(<SupplyStoreDetail snapshot={demoSnapshot()}/>);
 for(const period of ["days","weeks","months","years"]){
  fireEvent.change(screen.getByLabelText("Supply Revenue Over Time period"),{target:{value:period}});
  const plot=screen.getByRole("img",{name:"Performance over time"});
  const labels=chartLabels(plot);
  expect(labels).toHaveLength(within(plot).getAllByRole("button").length);
  expect(labels).toContain("R0");
  expect(labels.every(label=>/^R[\d,]+(?:\.\d{1,2})?$/.test(label??""))).toBe(true);
 }
 const bars=screen.getByRole("img",{name:"Performance ranking"});
 expect(chartLabels(bars)).toHaveLength(within(bars).getAllByRole("button").length);
 fireEvent.change(screen.getByLabelText("Supply Revenue by Category period"),{target:{value:"years"}});
 const yearlyBars=screen.getByRole("img",{name:"Performance ranking"});
 expect(chartLabels(yearlyBars)).toHaveLength(within(yearlyBars).getAllByRole("button").length);
 fireEvent.click(screen.getByRole("button",{name:"Expand Supply Revenue by Category"}));
 const fullBars=within(screen.getByRole("dialog")).getByRole("img",{name:"Performance ranking"});
 expect(chartLabels(fullBars)).toEqual(chartLabels(yearlyBars));
});
it("keeps zero labels visible when every daily revenue bucket is empty",()=>{
 const snapshot=demoSnapshot();snapshot.allocations=[];
 render(<SupplyStoreDetail snapshot={snapshot}/>);
 fireEvent.change(screen.getByLabelText("Supply Revenue Over Time period"),{target:{value:"days"}});
 const plot=screen.getByRole("img",{name:"Performance over time"});
 expect(chartLabels(plot)).toHaveLength(14);
 expect(chartLabels(plot).every(label=>label==="R0")).toBe(true);
});
it("formats existing chronological buckets without replacing their dates",()=>{
 expect(["2026-10-08","2026-10-09","2026-10-10"].map((value,index)=>supplyTrendTick(value,index,"days"))).toEqual(["Day 1","Day 2","Day 3"]);
 expect(["2026-10-05","2026-10-12"].map((value,index)=>supplyTrendTick(value,index,"weeks"))).toEqual(["Week 1","Week 2"]);
 expect(supplyTrendTick("2025-12",0,"months")).toBe("December");
 expect(supplyTrendTick("2026-01",1,"months")).toBe("January");
 expect(supplyTrendTick("2026",4,"years")).toBe("2026");
});
it("switches chart modes and periods and preserves the selected period on expansion",()=>{
 const snapshot=demoSnapshot();
 render(<SupplyStoreDetail snapshot={snapshot}/>);
 expect(screen.getByRole("heading",{name:"Centurion Branch"})).toBeTruthy();
 expect(screen.getByText("Main Road, Centurion, Gauteng, 0157")).toBeTruthy();
 expect(screen.getByText("Supply This Month")).toBeTruthy();
 expect(screen.getByText("Revenue From This Year's Supply")).toBeTruthy();
 expect(screen.getByRole("heading",{name:"Supply Revenue Over Time"})).toBeTruthy();
 const revenuePlot=screen.getByRole("img",{name:"Performance over time"});
 const points=within(revenuePlot).getAllByRole("button");
 expect(points[0].getAttribute("aria-label")).toMatch(/^[A-Z][a-z]+, [A-Z][a-z]+ \d{4}: R/);
 fireEvent.change(screen.getByLabelText("Supply Revenue Over Time period"),{target:{value:"days"}});
 const dailyPlot=screen.getByRole("img",{name:"Performance over time"});
 const dailyPoint=within(dailyPlot).getAllByRole("button")[0];
 expect(dailyPoint.getAttribute("aria-label")).toMatch(/^Day 1, \d{1,2} [A-Z][a-z]+ \d{4}: R/);
 fireEvent.mouseEnter(dailyPoint);
 expect(within(dailyPlot).getAllByText("Day 1").length).toBeGreaterThan(0);
 fireEvent.change(screen.getByLabelText("Supply Revenue Over Time period"),{target:{value:"weeks"}});
 expect((screen.getByLabelText("Supply Revenue Over Time period") as HTMLSelectElement).value).toBe("weeks");
 expect(within(screen.getByRole("img",{name:"Performance over time"})).getAllByRole("button")[0].getAttribute("aria-label")).toMatch(/^Week 1, Week of /);
 fireEvent.click(screen.getByRole("button",{name:"Expand Supply Revenue Over Time"}));
 const revenueDialog=screen.getByRole("dialog");
 expect(within(revenueDialog).getByRole("heading",{name:"Supply Revenue Over Time"})).toBeTruthy();
 expect(within(within(revenueDialog).getByRole("img",{name:"Performance over time"})).getAllByRole("button")[0].getAttribute("aria-label")).toMatch(/^Week 1, Week of /);
 fireEvent.click(within(revenueDialog).getByRole("button",{name:"Close Supply Revenue Over Time"}));
 fireEvent.click(screen.getByRole("button",{name:"Product Performance"}));
 expect(screen.getByRole("heading",{name:"Supplied Products Sold Over Time"})).toBeTruthy();
 expect(screen.getByRole("heading",{name:"Product Sales Performance"})).toBeTruthy();
 expect((screen.getByLabelText("Supplied Products Sold Over Time period") as HTMLSelectElement).value).toBe("weeks");
 fireEvent.click(screen.getByRole("button",{name:"Expand Supplied Products Sold Over Time"}));
 const dialog=screen.getByRole("dialog");
 expect(within(dialog).getByRole("heading",{name:"Supplied Products Sold Over Time"})).toBeTruthy();
 expect((within(dialog).getByLabelText("Supplied Products Sold Over Time period") as HTMLSelectElement).value).toBe("weeks");
 fireEvent.click(within(dialog).getByRole("button",{name:"Close Supplied Products Sold Over Time"}));
 expect(screen.queryByRole("dialog")).toBeNull();
 expect((screen.getByLabelText("Supplied Products Sold Over Time period") as HTMLSelectElement).value).toBe("weeks");
});
