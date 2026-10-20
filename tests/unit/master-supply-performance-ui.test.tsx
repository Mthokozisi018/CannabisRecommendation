// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("server-only",()=>({}));
import { createSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import { SupplyStoreDetail } from "@/components/master-supply/SupplyStoreDetail";
import type { SupplyStore } from "@/lib/master-supply/data";

afterEach(cleanup);
it("switches chart modes and periods and preserves the selected period on expansion",()=>{
 const store:SupplyStore={id:"00000000-0000-4000-8000-000000000001",name:"Centurion Branch",city:"Centurion",province:"Gauteng",store_image_url:null,is_active:true,store_access_status:"active",physical_store_address:"Main Road",postal_code:"0157",store_phone_number:"012 555 0100",store_contact_email:"centurion@example.com",created_at:"2026-01-01T12:00:00Z"};
 const snapshot=createSupplyDemoSnapshot("franchise","actor",[store],new Date());
 snapshot.storeId=store.id;
 render(<SupplyStoreDetail snapshot={snapshot}/>);
 expect(screen.getByRole("heading",{name:"Centurion Branch"})).toBeTruthy();
 expect(screen.getByText("Main Road, Centurion, Gauteng, 0157")).toBeTruthy();
 expect(screen.getByText("Supply This Month")).toBeTruthy();
 expect(screen.getByText("Revenue From This Year's Supply")).toBeTruthy();
 expect(screen.getByRole("heading",{name:"Supply Revenue Over Time"})).toBeTruthy();
 fireEvent.change(screen.getByLabelText("Supply Revenue Over Time period"),{target:{value:"weeks"}});
 expect((screen.getByLabelText("Supply Revenue Over Time period") as HTMLSelectElement).value).toBe("weeks");
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
