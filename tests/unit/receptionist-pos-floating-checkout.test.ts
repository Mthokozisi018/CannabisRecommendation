import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Receptionist POS floating checkout shortcut", () => {
  it("uses the existing Current Sale section as a navigation target", () => {
    const pos = source("components/receptionist/pos/ReceptionistPOS.tsx");

    expect(pos).toContain("FloatingCheckoutButton");
    expect(pos).toContain('id="current-sale"');
    expect(pos).toContain("checkoutSectionRef");
    expect(pos).toContain("scrollIntoView");
    expect(pos).toContain('aria-label="Go to checkout"');
    expect(pos).toContain("IntersectionObserver");
    expect(pos).toContain("prefers-reduced-motion: reduce");
    expect(pos).not.toContain("window.location");
  });
});
