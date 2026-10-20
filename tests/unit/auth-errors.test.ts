import { describe, expect, it } from "vitest";
import {
  AccountLookupUnavailableError,
  classifySupabaseAuthSessionError,
  isInvalidSupabaseSessionError,
  isTemporaryDependencyError
} from "@/lib/auth-errors";

describe("auth failure classification", () => {
  it("classifies invalid refresh tokens as invalid sessions", () => {
    const error = Object.assign(new Error("Invalid Refresh Token: Refresh Token Not Found"), {
      code: "refresh_token_not_found"
    });

    expect(isInvalidSupabaseSessionError(error)).toBe(true);
    expect(classifySupabaseAuthSessionError(error)).toBe("invalid_session");
  });

  it("classifies timeouts and gateway errors as temporary dependency failures", () => {
    const timeout = Object.assign(new Error("Gateway Timeout"), { status: 504 });

    expect(isTemporaryDependencyError(timeout)).toBe(true);
    expect(classifySupabaseAuthSessionError(timeout)).toBe("temporary_service_failure");
  });

  it("keeps profile lookup failures separate from authentication failures", () => {
    const lookup = new AccountLookupUnavailableError("customer_profile_lookup", new Error("fetch failed"));

    expect(lookup.category).toBe("account_lookup_failed");
    expect(lookup.stage).toBe("customer_profile_lookup");
    expect(lookup.temporary).toBe(true);
  });
});
