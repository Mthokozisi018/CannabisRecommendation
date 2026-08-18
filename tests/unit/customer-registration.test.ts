import { describe, expect, it } from "vitest";
import { normalizeSouthAfricanPhone, validateSouthAfricanId } from "@/lib/customer/validation";

function withValidLuhnCheckDigit(firstTwelveDigits: string) {
  for (let digit = 0; digit <= 9; digit += 1) {
    const candidate = `${firstTwelveDigits}${digit}`;
    let sum = 0;
    let doubleDigit = false;
    for (let index = candidate.length - 1; index >= 0; index -= 1) {
      let value = Number(candidate[index]);
      if (doubleDigit) {
        value *= 2;
        if (value > 9) value -= 9;
      }
      sum += value;
      doubleDigit = !doubleDigit;
    }
    if (sum % 10 === 0) return candidate;
  }
  throw new Error("Unable to create test ID.");
}

describe("customer registration identity validation", () => {
  it("accepts a checksum-valid South African ID for a customer who is exactly 18", () => {
    const id = withValidLuhnCheckDigit("080814500908");
    const result = validateSouthAfricanId(id, new Date("2026-08-14T12:00:00Z"));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.age).toBe(18);
  });

  it("rejects a customer before their eighteenth birthday", () => {
    const id = withValidLuhnCheckDigit("080815500908");
    const result = validateSouthAfricanId(id, new Date("2026-08-14T12:00:00Z"));
    expect(result.valid).toBe(false);
  });

  it("rejects an invalid checksum", () => {
    expect(validateSouthAfricanId("0808145009080", new Date("2026-08-14T12:00:00Z")).valid).toBe(false);
  });

  it("normalizes common South African phone formats", () => {
    expect(normalizeSouthAfricanPhone("082 123 4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("+27 82 123 4567")).toBe("+27821234567");
  });
});

