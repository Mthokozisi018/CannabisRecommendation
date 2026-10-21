import { afterEach, describe, expect, it, vi } from "vitest";
import { greenChoiceEnvironment } from "@/lib/environment";

vi.mock("server-only", () => ({}));

const original = {
  greenchoice: process.env.GREENCHOICE_ENV,
  vercel: process.env.VERCEL_ENV,
  project: process.env.VERCEL_PROJECT_ID,
};

afterEach(() => {
  for (const [name, value] of [
    ["GREENCHOICE_ENV", original.greenchoice],
    ["VERCEL_ENV", original.vercel],
    ["VERCEL_PROJECT_ID", original.project],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("dedicated staging Vercel project", () => {
  it("permits staging identity on its own production target", () => {
    process.env.GREENCHOICE_ENV = "staging";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_ID = "prj_lsDmicOEXf0xB3wV2hFvqSR82wBB";
    expect(greenChoiceEnvironment()).toBe("staging");
  });

  it("rejects staging identity on another production project", () => {
    process.env.GREENCHOICE_ENV = "staging";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_ID = "prj_other";
    expect(() => greenChoiceEnvironment()).toThrow("A Vercel production deployment must use the production environment identity.");
  });
});
