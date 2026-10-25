import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const storesQuery = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: storesQuery
  }))
}));

import { GET } from "@/app/api/health/readiness/route";

const readinessSecret = "readiness-test-secret-that-is-long-enough";

function databaseResult(error: unknown) {
  storesQuery.mockReturnValue({
    select: vi.fn(() => ({
      limit: vi.fn(() => Promise.resolve({ error }))
    }))
  });
}

beforeEach(() => {
  vi.stubEnv("READINESS_DIAGNOSTIC_SECRET", readinessSecret);
  storesQuery.mockReset();
  databaseResult(null);
});

describe("database readiness endpoint", () => {
  it("rejects an unauthenticated request without querying the database", async () => {
    const response = await GET(new Request("https://greenchoice.example/api/health/readiness"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false });
    expect(storesQuery).not.toHaveBeenCalled();
  });

  it("returns a minimal successful response when Supabase is reachable", async () => {
    const response = await GET(new Request("https://greenchoice.example/api/health/readiness", {
      headers: { authorization: `Bearer ${readinessSecret}` }
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(storesQuery).toHaveBeenCalledWith("stores");
  });

  it("rejects a non-ASCII token of the same character length without throwing", async () => {
    const response = await GET(new Request("https://greenchoice.example/api/health/readiness", {
      headers: { authorization: `Bearer ${"é".repeat(readinessSecret.length)}` }
    }));
    expect(response.status).toBe(401);
    expect(storesQuery).not.toHaveBeenCalled();
  });

  it("fails closed without exposing a database error", async () => {
    databaseResult(new Error("sensitive database detail"));
    const response = await GET(new Request("https://greenchoice.example/api/health/readiness", {
      headers: { authorization: `Bearer ${readinessSecret}` }
    }));

    expect(response.status).toBe(503);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ ok: false });
    expect(body).not.toContain("sensitive database detail");
  });
});
