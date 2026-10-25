import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
import SupplyLoading from "@/app/dashboard/franchise/supply/loading";

it("shows the existing GreenChoice spinner while the supply route streams",()=>{
  const html=renderToStaticMarkup(<SupplyLoading/>);
  expect(html).toContain('role="status"');
  expect(html).toContain("Loading Master Supply Management");
  expect(html).toContain("greenchoice-loader-ring");
});
