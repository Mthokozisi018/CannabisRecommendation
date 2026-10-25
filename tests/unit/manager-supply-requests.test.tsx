// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ManagerSupplyRequestForm, ManagerSupplyRequests } from "@/components/manager/ManagerSupplyRequests";
import { masterSupplyAction } from "@/app/dashboard/franchise/supply/actions";
import { supplyRequestSchema, type ManagerSupplyRequestsData } from "@/lib/manager/supply-request-model";
vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("@/app/dashboard/franchise/supply/actions",()=>({masterSupplyAction:vi.fn()}));
beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){ this.setAttribute("open",""); };
  HTMLDialogElement.prototype.close=function(){ this.removeAttribute("open"); };
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
const first="10000000-0000-4000-8000-000000000001",second="10000000-0000-4000-8000-000000000002";
const store="20000000-0000-4000-8000-000000000001";
export function requestData():ManagerSupplyRequestsData { return {
  context:{store_id:store,store_name:"Pretoria Store",franchise_id:"franchise",franchise_name:"GreenChoice Franchise"},
  products:[{id:first,sku:"GC-F1",name:"Sunrise",category:"Flower",subcategory:"Sativa",strain_type:"Sativa",cultivation_type:"Indoor",image_url:null,available:true},
    {id:second,sku:"GC-E1",name:"Berry Gummies",category:"Edibles",subcategory:"Gummies",strain_type:null,cultivation_type:null,image_url:null,available:true},
    {id:"10000000-0000-4000-8000-000000000003",sku:"GC-F2",name:"Unavailable Flower",category:"Flower",subcategory:"Indica",strain_type:"Indica",cultivation_type:"Outdoor",image_url:null,available:false}],
  requests:[], distributions:[],
}; }
function add(name:string,qty:string) {
  const article=screen.getByRole("heading",{name}).closest("article")!;
  fireEvent.change(within(article).getByRole("spinbutton"),{target:{value:qty}});
  fireEvent.click(within(article).getByRole("button",{name:/Add to Request|Update Request/}));
}
it("browses real product classifications and reviews multiple editable products without stock limits",async()=>{
  vi.mocked(masterSupplyAction).mockResolvedValue({ok:true,id:"saved"});
  render(<ManagerSupplyRequestForm data={requestData()}/>);
  expect(screen.getByRole("button",{name:"Review Supply Request"})).toHaveProperty("disabled",true);
  expect(within(screen.getByRole("heading",{name:"Unavailable Flower"}).closest("article")!).getByRole("button")).toHaveProperty("disabled",true);
  add("Sunrise","500"); add("Sunrise","600");
  expect(screen.getAllByLabelText("Selected quantity for Sunrise")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button",{name:"Edibles"}));
  expect(screen.queryByLabelText("Cultivation Type")).toBeNull(); expect(screen.queryByLabelText("Strain Type")).toBeNull();
  add("Berry Gummies","20");
  fireEvent.change(screen.getByLabelText("Optional manager notes"),{target:{value:"Weekend replenishment"}});
  fireEvent.click(screen.getByRole("button",{name:"Review Supply Request"}));
  expect(screen.getByRole("heading",{name:"Review Supply Request"})).toBeTruthy();
  expect(screen.getByText("600 requested")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Submit Supply Request"}));
  expect(masterSupplyAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Confirm Submission"}));
  await screen.findByRole("heading",{name:"Supply Request Submitted Successfully"});
  expect(masterSupplyAction).toHaveBeenCalledTimes(1);
  expect(masterSupplyAction).toHaveBeenCalledWith("request",expect.objectContaining({expectedStoreId:store,notes:"Weekend replenishment",items:[{productId:first,quantity:600},{productId:second,quantity:20}]}));
});
it("does not show success before the database confirms and reuses a request key after uncertain failures",async()=>{
  vi.mocked(masterSupplyAction).mockRejectedValueOnce(new Error("Network interrupted")).mockResolvedValueOnce({ok:true,id:"saved"});
  render(<ManagerSupplyRequestForm data={requestData()}/>); add("Sunrise","2");
  fireEvent.click(screen.getByRole("button",{name:"Review Supply Request"}));
  fireEvent.click(screen.getByRole("button",{name:"Submit Supply Request"}));
  fireEvent.click(screen.getByRole("button",{name:"Confirm Submission"}));
  await screen.findByRole("alert");
  expect(screen.queryByText("Supply Request Submitted Successfully")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Submit Supply Request"}));
  fireEvent.click(screen.getByRole("button",{name:"Confirm Submission"}));
  fireEvent.click(screen.getByRole("button",{name:/Confirm Submission|Submitting/}));
  await screen.findByRole("heading",{name:"Supply Request Submitted Successfully"});
  expect(masterSupplyAction).toHaveBeenCalledTimes(2);
  expect(vi.mocked(masterSupplyAction).mock.calls[0][1]).toEqual(vi.mocked(masterSupplyAction).mock.calls[1][1]);
});
it("shows own request details, rejection reasons and distribution progress",async()=>{
  const data=requestData();
  data.requests=[{id:"r",franchise_id:"franchise",store_id:store,requested_by:"manager",status:"rejected",notes:"Please replenish",rejection_reason:"Product replaced",created_at:"2026-10-23T08:00:00Z",reviewed_at:null,master_supply_request_items:[{product_id:first,requested_quantity:30,approved_quantity:0}]}];
  render(<ManagerSupplyRequests data={data}/>);
  fireEvent.click(screen.getByRole("button",{name:"View"}));
  expect(screen.getByText("Rejection reason: Product replaced")).toBeTruthy();
  expect(screen.getByText("Sunrise")).toBeTruthy();
  await waitFor(()=>expect(screen.getByText("Rejected")).toBeTruthy());
});
it("rejects duplicate, manipulated and invalid submission payloads",()=>{
  const base={id:crypto.randomUUID(),expectedStoreId:store,notes:"",items:[{productId:first,quantity:50}]};
  expect(supplyRequestSchema.safeParse(base).success).toBe(true);
  for(const quantity of [0,-1,1.2,NaN,Infinity]) expect(supplyRequestSchema.safeParse({...base,items:[{productId:first,quantity}]}).success).toBe(false);
  expect(supplyRequestSchema.safeParse({...base,items:[...base.items,...base.items]}).success).toBe(false);
  expect(supplyRequestSchema.safeParse({...base,franchiseId:"other"}).success).toBe(false);
});
