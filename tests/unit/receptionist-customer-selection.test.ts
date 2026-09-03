import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { customerFullName, normalizePOSCustomerPhone } from "@/lib/pos-customer-format";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("receptionist customer selection", () => {
  it("normalizes supported South African cellphone formats", () => {
    expect(normalizePOSCustomerPhone("082 123 4567")).toEqual({ normalized: "+27821234567", digits: "0821234567", display: "082 123 4567" });
    expect(normalizePOSCustomerPhone("+27 82 123 4567")?.normalized).toBe("+27821234567");
    expect(normalizePOSCustomerPhone("821234567")?.normalized).toBe("+27821234567");
    expect(normalizePOSCustomerPhone("123")).toBeNull();
    expect(customerFullName(" Ada ", " Lovelace ")).toBe("Ada Lovelace");
  });

  it("keeps search and registration in exclusive modes", () => {
    const dialog = source("components/receptionist/pos/CustomerCheckoutDialog.tsx");
    expect(dialog).toContain('type DialogMode = "search" | "register"');
    expect(dialog).toContain('dialogMode === "search" ?');
    expect(dialog).toContain('setDialogMode("register")');
    expect(dialog).toContain('setDialogMode("search")');
    expect(dialog).toContain("Register New Customer");
    expect(dialog).toContain("Search Existing Customer");
    expect(dialog).toContain("registrationLocked.current");
    expect(dialog).toContain("searchSequence.current");
  });

  it("bounds and store-scopes server-side customer access", () => {
    const customers = source("lib/receptionist/customers.ts");
    expect(customers).toContain('.eq("store_id", staff.storeId)');
    expect(customers).toContain(".limit(8)");
    expect(customers).toContain("receptionist:customer-search:");
    expect(customers).toContain("receptionist:customer-register:");
    expect(customers).toContain('error.code === "23505"');
  });
});
