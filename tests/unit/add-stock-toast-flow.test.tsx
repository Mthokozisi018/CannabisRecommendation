// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AddStockForm } from "@/components/manager/forms/AddStockForm";
import { registerAddStockSupplier } from "@/app/dashboard/manager/inventory/manage/actions";
import type { ManagerActionState } from "@/app/dashboard/manager/actions";
import type { ManagerInventoryProduct } from "@/lib/manager/data";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/dashboard/manager/actions", () => ({ createProductAction: vi.fn(), addInventoryStockAction: vi.fn() }));
vi.mock("@/app/dashboard/manager/inventory/manage/actions", () => ({ registerAddStockSupplier: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("shows product success only after the creation action confirms a saved product", async () => {
  let resolve!: (value: ManagerActionState) => void;
  const submittedForms: FormData[] = [];
  const create = vi.fn((_previous: ManagerActionState, form: FormData) => { submittedForms.push(form); return new Promise<ManagerActionState>(done => { resolve = done; }); });
  render(<AddStockForm products={[]} suppliers={[{id:"supplier",name:"Supplier",categories:[{category:"Accessories",subcategory:"Lighters"}]}]}
    backHref="/dashboard/manager" storeName="Test Store" managerName="Manager" createAction={create} addStockAction={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Accessories" }));
  fireEvent.change(screen.getByLabelText(/Accessory Type/), { target: { value: "Lighters" } });
  fireEvent.click(screen.getByRole("button", { name: /New Product/ }));
  fireEvent.change(screen.getByLabelText(/Product Name/), { target: { value: "New Lighter" } });
  fireEvent.change(screen.getByLabelText(/Price \(ZAR\)/), { target: { value: "25" } });
  expect(screen.queryByLabelText(/Quantity to Add/)).toBeNull();
  expect(screen.queryByRole("combobox", { name: /^Supplier/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Save Product$/ }));
  expect(create).toHaveBeenCalledTimes(1);
  expect(submittedForms[0]?.get("initialStockQuantity")).toBe("0");
  expect(submittedForms[0]?.get("supplierId")).toBe("");
  expect(submittedForms[0]?.get("supplierUnitCost")).toBe("");
  expect(screen.queryByText("Product Added Successfully")).toBeNull();
  await act(async () => resolve({ok:true,message:"Saved",createdProduct:{id:"new-product",product_name:"New Lighter"} as ManagerInventoryProduct}));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Product Added Successfully"));
  expect(refresh).toHaveBeenCalled();
});

it("offers a store supplier again for another product type", () => {
  const products = ["Lighters", "Rolling Papers"].map((subcategory) => ({ id: subcategory, product_name: subcategory, category: "Accessories", subcategory, price: 25, inventory_stock: { current_quantity: 0, low_stock_threshold: 2 } })) as ManagerInventoryProduct[];
  render(<AddStockForm products={products} suppliers={[{ id: "supplier", name: "Reusable Supplier", categories: [{ category: "Accessories", subcategory: "Lighters" }] }]}
    backHref="/dashboard/manager" storeName="Test Store" managerName="Manager" createAction={vi.fn()} addStockAction={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Accessories" }));
  fireEvent.change(screen.getByLabelText(/Accessory Type/), { target: { value: "Rolling Papers" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Product/ }), { target: { value: "Rolling Papers" } });
  expect(screen.getByRole("option", { name: "Reusable Supplier" })).toBeTruthy();
});

it("adds a newly registered supplier to the dropdown immediately", async () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
  vi.mocked(registerAddStockSupplier).mockResolvedValue({ ok: true, message: "Supplier registered.", supplier: { id: "new-supplier", name: "New Supplier Co", categories: [{ category: "Accessories", subcategory: "Lighters" }] } });
  const product = { id: "lighter", product_name: "Lighter", category: "Accessories", subcategory: "Lighters", price: 25, inventory_stock: { current_quantity: 0, low_stock_threshold: 2 } } as ManagerInventoryProduct;
  render(<AddStockForm products={[product]} suppliers={[]} backHref="/dashboard/manager" storeName="Test Store" managerName="Manager" createAction={vi.fn()} addStockAction={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Accessories" }));
  fireEvent.change(screen.getByLabelText(/Accessory Type/), { target: { value: "Lighters" } });
  fireEvent.click(screen.getByRole("button", { name: "New Supplier" }));
  fireEvent.change(screen.getByLabelText(/Supplier Name/), { target: { value: "New Supplier Co" } });
  fireEvent.click(screen.getByRole("button", { name: "Register Supplier" }));
  await waitFor(() => expect(screen.getByRole("option", { name: "New Supplier Co" })).toBeTruthy());
  expect(screen.getByRole("combobox", { name: /^Supplier/ })).toHaveProperty("value", "new-supplier");
});

it("reports a failed stock update, then confirms an existing product's quantity change", async () => {
  const stock = vi.fn().mockResolvedValueOnce({ok:false,message:"Stock could not be saved."})
    .mockResolvedValueOnce({ok:true,message:"Stock saved.",updatedStock:8});
  const product = {id:"existing-product",product_name:"Existing Lighter",category:"Accessories",subcategory:"Lighters",price:25,
    inventory_stock:{current_quantity:5,low_stock_threshold:2}} as ManagerInventoryProduct;
  render(<AddStockForm products={[product]} suppliers={[{id:"supplier",name:"Supplier",categories:[{category:"Accessories",subcategory:"Lighters"}]}]}
    backHref="/dashboard/manager" storeName="Test Store" managerName="Manager" createAction={vi.fn()} addStockAction={stock} />);
  fireEvent.click(screen.getByRole("button", { name: "Accessories" }));
  fireEvent.change(screen.getByLabelText(/Accessory Type/), { target: { value: "Lighters" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Product/ }), { target: { value: "existing-product" } });
  fireEvent.change(screen.getByRole("combobox", { name: /^Supplier/ }), { target: { value: "supplier" } });
  fireEvent.change(screen.getByLabelText(/Supplier Unit Cost/), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/Quantity to Add/), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: /^Add Stock$/ }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Stock Could Not Be Updated"));
  expect(screen.queryByText("Stock Updated Successfully")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Add Stock$/ }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Stock Updated Successfully"));
  expect(screen.queryByText("Product Added Successfully")).toBeNull();
  expect(stock).toHaveBeenCalledTimes(2);
});
