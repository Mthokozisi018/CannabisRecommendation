import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("receptionist customer security contracts", () => {
  it("authenticates, verifies origins, and rate-limits customer actions", () => {
    const actions = source("app/dashboard/receptionist/actions.ts");
    const customers = source("lib/receptionist/customers.ts");
    expect(actions).toContain("verifyOrigin()");
    expect(customers).toContain('requireStaff(["manager", "receptionist"])');
    expect(customers).toContain("assertRateLimit(");
  });

  it("derives customer scope from the authenticated staff store", () => {
    const customers = source("lib/receptionist/customers.ts");
    expect(customers).toContain('.eq("store_id", staff.storeId)');
    expect(customers).toContain("createSupabaseServerClient()");
    expect(customers).not.toMatch(/storeId:\s*z\./);
    expect(customers).toContain('.select("id, first_name, surname, phone_display, phone_normalized")');
    expect(customers).toContain(".limit(8)");
  });

  it("binds checkout to a server-validated customer and remains idempotent", () => {
    const actions = source("app/dashboard/receptionist/actions.ts");
    expect(actions).toContain("customerId: z.string().uuid");
    expect(actions).toContain("p_customer_id: parsed.customerId");
    expect(actions).toContain("checkoutId: z.string().uuid()");
    expect(actions).not.toContain("p_store_id");
  });
});
