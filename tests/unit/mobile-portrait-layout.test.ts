import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("mobile portrait layout", () => {
  it("scopes POS product grid, account placement, and login fit fixes to phone portrait CSS", () => {
    const css = source("app/globals.css");
    const grid = source("components/receptionist/pos/ProductGrid.tsx");
    const card = source("components/receptionist/pos/ProductCard.tsx");
    const pos = source("components/receptionist/pos/ReceptionistPOS.tsx");
    const login = source("app/login/page.tsx");

    expect(css).toContain("@media (max-width: 639px) and (orientation: portrait)");
    expect(css).toContain(".gc-pos-product-grid");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).toContain("overflow-x: clip");
    expect(css).toContain(".gc-login-page");
    expect(css).toContain("min-height: 100dvh");
    expect(css).toContain(".gc-login-input-shell");
    expect(css).toContain("padding-inline: 0.9rem");
    expect(css).toContain(".gc-pos-account-slot");
    expect(css).toContain("position: absolute");
    expect(grid).toContain("gc-pos-product-grid");
    expect(card).toContain("gc-pos-product-card");
    expect(pos).toContain("gc-pos-account-slot");
    expect(login).toContain("gc-login-page");
    expect(source("app/login/LoginForm.tsx")).toContain("gc-login-input-shell");
  });

  it("does not edit the receptionist filter component or filter logic", () => {
    const filter = source("components/receptionist/pos/FilterPanel.tsx");
    const css = source("app/globals.css");

    expect(filter).not.toContain("gc-pos-product-grid");
    expect(filter).not.toContain("gc-login-page");
    expect(css).not.toContain("FilterPanel");
  });
});
