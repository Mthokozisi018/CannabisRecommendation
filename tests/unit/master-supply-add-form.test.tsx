// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SupplyInventory } from "@/components/master-supply/SupplyInventory";
import { createSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import { masterSupplyAction } from "@/app/dashboard/franchise/supply/actions";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/dashboard/franchise/supply/actions", () => ({ masterSupplyAction: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const snapshot = () => createSupplyDemoSnapshot("franchise", "actor", [], new Date("2026-10-20T10:00:00Z"));
function open() {
  const result = render(<SupplyInventory snapshot={snapshot()} />);
  fireEvent.click(screen.getByRole("button", { name: /Add Supply/ }));
  return { ...result, dialog: screen.getByRole("dialog", { name: "Add supply" }) };
}
function chooseFlower() {
  fireEvent.click(screen.getByRole("button", { name: "Flower" }));
  fireEvent.change(screen.getByLabelText("Strain Type"), { target: { value: "Hybrid" } });
  fireEvent.change(screen.getByLabelText("Cultivation Type"), { target: { value: "Indoor" } });
}

it("opens a compact category-driven modal and closes on request", () => {
  const { dialog } = open();
  expect(dialog.textContent).toContain("Select Category");
  expect(within(dialog).getAllByRole("button", { pressed: false }).map(button => button.textContent)).toEqual(expect.arrayContaining(["Flower", "Pre-Rolls", "Edibles", "Accessories", "Vape Cartridges"]));
  fireEvent.click(screen.getByRole("button", { name: "Edibles" }));
  expect(screen.getByLabelText("Edible Type")).toBeTruthy();
  expect(screen.queryByLabelText("Cultivation Type")).toBeNull();
  expect(screen.getByRole("dialog").querySelector("img")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("shows vape subcategories and strain options and finds legacy master products", () => {
  const { dialog } = open();
  fireEvent.click(screen.getByRole("button", { name: "Vape Cartridges" }));
  expect(within(within(dialog).getByLabelText("Subcategory")).getAllByRole("option").map(option => option.textContent)).toEqual(["Select a type", "Vape Cartridge", "Disposable Vape"]);
  expect(screen.getByLabelText("Vape Strain")).toBeTruthy();
  expect(screen.queryByLabelText("Cultivation Type")).toBeNull();
  fireEvent.change(within(dialog).getByLabelText("Subcategory"), { target: { value: "Vape Cartridge" } });
  fireEvent.change(screen.getByLabelText("Vape Strain"), { target: { value: "Hybrid" } });
  expect(within(screen.getByLabelText("Existing Product")).getAllByRole("option").map(option => option.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("GreenChoice Botanical Vape")]));
});

it("adds stock to the selected master product and updates the table immediately", async () => {
  const product = snapshot().products[0];
  vi.mocked(masterSupplyAction).mockResolvedValue({ ok: true, id: product.id });
  open(); chooseFlower();
  fireEvent.change(screen.getByLabelText("Existing Product"), { target: { value: product.id } });
  expect(screen.getByText(/After supply:/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Quantity Received (g)"), { target: { value: "50" } });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Supply" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(masterSupplyAction).toHaveBeenCalledWith("add_stock", expect.objectContaining({ productId: product.id, quantity: 50 }));
  expect(screen.getByRole("status").textContent).toContain("50 g");
  expect(within(screen.getByRole("table")).getByText("350 available")).toBeTruthy();
});

it("creates a product with its initial supply in one action and rejects duplicates", async () => {
  vi.mocked(masterSupplyAction).mockResolvedValue({ ok: true, id: "new-product-id", sku:"GC-MS-FLW-NEW", supplierCostPrice:90 });
  open(); chooseFlower();
  fireEvent.click(screen.getByRole("button", { name: "Add New Product" }));
  expect(screen.queryByLabelText("SKU")).toBeNull();
  expect(screen.queryByLabelText("Image URL (optional)")).toBeNull();
  expect(screen.queryByLabelText("Description (optional)")).toBeNull();
  fireEvent.change(screen.getByLabelText("Product Name"), { target: { value: "GreenChoice Sunrise Flower" } });
  fireEvent.change(screen.getByLabelText("Supplier Cost Price (ZAR)"), { target: { value: "90" } });
  fireEvent.change(screen.getByLabelText("Store Selling Price (ZAR)"), { target: { value: "140" } });
  fireEvent.change(screen.getByLabelText("Quantity Received (g)"), { target: { value: "80" } });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Supply" }));
  expect(screen.getByRole("alert").textContent).toContain("already exists");
  expect(masterSupplyAction).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Product Name"), { target: { value: "New Hybrid Flower" } });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Supply" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const [action,payload]=vi.mocked(masterSupplyAction).mock.calls[0];
  expect(action).toBe("create_product");
  expect(payload).toBeInstanceOf(FormData);
  expect(Object.fromEntries((payload as FormData).entries())).toMatchObject({ name:"New Hybrid Flower", quantity:"80",category:"Flower",subcategory:"Hybrid",cultivationType:"Indoor",supplierCostPrice:"90",price:"140" });
  expect((payload as FormData).has("sku")).toBe(false);
  expect(within(screen.getByRole("table")).getByText("New Hybrid Flower")).toBeTruthy();
  expect(within(screen.getByRole("table")).getByText("GC-MS-FLW-NEW")).toBeTruthy();
  expect(within(screen.getByRole("table")).getByText("80 available")).toBeTruthy();
});

it("previews, replaces and removes a selected product picture",()=>{
  Object.defineProperty(URL,"createObjectURL",{configurable:true,value:vi.fn((file:File)=>`blob:${file.name}`)});
  Object.defineProperty(URL,"revokeObjectURL",{configurable:true,value:vi.fn()});
  open(); chooseFlower();
  fireEvent.click(screen.getByRole("button",{name:"Add New Product"}));
  const picker=screen.getByLabelText("Product Image (Optional)") as HTMLInputElement;
  expect(picker.accept).toBe("image/jpeg,image/png,image/webp");
  expect(screen.getByRole("button",{name:"Upload Image"})).toBeTruthy();
  fireEvent.change(picker,{target:{files:[new File(["one"],"one.png",{type:"image/png"})]}});
  expect(screen.getByRole("dialog").querySelector('img[src="blob:one.png"]')).toBeTruthy();
  fireEvent.change(picker,{target:{files:[new File(["two"],"two.webp",{type:"image/webp"})]}});
  expect(screen.getByRole("dialog").querySelector('img[src="blob:two.webp"]')).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Remove Image"}));
  expect(screen.getByRole("dialog").querySelector("img")?.getAttribute("src")).not.toContain("blob:");
});

it("shows the stored uploaded image in the Master Inventory row after saving",async()=>{
  Object.defineProperty(URL,"createObjectURL",{configurable:true,value:vi.fn(()=>"blob:new-image")});
  Object.defineProperty(URL,"revokeObjectURL",{configurable:true,value:vi.fn()});
  vi.mocked(masterSupplyAction).mockResolvedValue({ok:true,id:"new-product-id",sku:"GC-MS-FLW-NEW",supplierCostPrice:80,imageUrl:"https://example.com/stored.webp"});
  open();chooseFlower();
  fireEvent.click(screen.getByRole("button",{name:"Add New Product"}));
  fireEvent.change(screen.getByLabelText("Product Name"),{target:{value:"Uploaded Master Flower"}});
  fireEvent.change(screen.getByLabelText("Supplier Cost Price (ZAR)"),{target:{value:"80"}});
  fireEvent.change(screen.getByLabelText("Store Selling Price (ZAR)"),{target:{value:"125"}});
  fireEvent.change(screen.getByLabelText("Quantity Received (g)"),{target:{value:"7"}});
  fireEvent.change(screen.getByLabelText("Product Image (Optional)"),{target:{files:[new File(["image"],"flower.jpg",{type:"image/jpeg"})]}});
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Add Supply"}));
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
  const row=within(screen.getByRole("table")).getByText("Uploaded Master Flower").closest("tr")!;
  expect(row.querySelector("img")?.getAttribute("src")).toBe("https://example.com/stored.webp");
  expect(row.textContent).toContain("7 available");
});
