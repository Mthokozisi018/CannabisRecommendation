// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  initialize: vi.fn(),
  implicitInitialize: vi.fn(),
  implicitGetSession: vi.fn(),
  setSession: vi.fn(),
  browserCreationHashes: [] as string[],
  verifyOtp: vi.fn(),
  listener: null as null | ((event: string, session: object | null) => void),
  implicitListener: null as null | ((event: string, session: object | null) => void),
  unsubscribe: vi.fn()
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => { auth.browserCreationHashes.push(window.location.hash); return { auth: {
    initialize: auth.initialize,
    verifyOtp: auth.verifyOtp,
    setSession: auth.setSession,
    onAuthStateChange: (callback: typeof auth.listener) => {
      auth.listener = callback;
      return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
    }
  } }; },
  createSupabaseImplicitRecoveryClient: () => ({ auth: {
    initialize: auth.implicitInitialize,
    getSession: auth.implicitGetSession,
    onAuthStateChange: (callback: typeof auth.implicitListener) => {
      auth.implicitListener = callback;
      return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
    }
  } })
}));
vi.mock("@/components/LoadingOverlay", () => ({ LoadingOverlay: () => null }));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));

import UpdatePasswordPage from "@/app/update-password/page";

beforeEach(() => {
  auth.listener = null;
  auth.implicitListener = null;
  auth.browserCreationHashes.length = 0;
  auth.initialize.mockResolvedValue({ error: null });
  auth.implicitInitialize.mockResolvedValue({ error: null });
  auth.implicitGetSession.mockResolvedValue({ data: { session: { access_token: "test", refresh_token: "refresh" } }, error: null });
  auth.setSession.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
  auth.verifyOtp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

async function openLink(path: string) {
  window.history.replaceState(null, "", path);
  render(<UpdatePasswordPage />);
  if (path.includes("#access_token")) {
    await waitFor(() => expect(auth.implicitListener).not.toBeNull());
    await act(async () => { await auth.implicitInitialize.mock.results[0]?.value; });
  } else {
    await waitFor(() => expect(auth.listener).not.toBeNull());
    await act(async () => { await auth.initialize.mock.results[0]?.value; });
  }
}

it("opens a first-use PKCE recovery link without exchanging its code twice", async () => {
  await openLink("/update-password?code=first-use-code&flow=recovery");
  await act(async () => { auth.listener?.("PASSWORD_RECOVERY", { access_token: "test" }); });
  await waitFor(() => expect(screen.getByRole("button", { name: "Reset password" }).hasAttribute("disabled")).toBe(false));
  expect(window.location.search).toBe("");
});

it("accepts a verified legacy recovery link without a flow query parameter", async () => {
  await openLink("/update-password#access_token=test&refresh_token=test&type=recovery");
  await waitFor(() => expect(screen.getByRole("button", { name: "Reset password" }).hasAttribute("disabled")).toBe(false));
  expect(auth.setSession).toHaveBeenCalledWith({ access_token: "test", refresh_token: "refresh" });
  expect(auth.browserCreationHashes).toEqual([""]);
  expect(window.location.hash).toBe("");
});

it("rejects an invalid implicit recovery session without opening the password form", async () => {
  auth.implicitInitialize.mockResolvedValueOnce({ error: new Error("invalid recovery token") });
  await openLink("/update-password?flow=recovery#access_token=invalid&refresh_token=invalid&type=recovery");
  expect(await screen.findByRole("heading", { name: "Password Reset Link Expired" })).toBeTruthy();
  expect(auth.setSession).not.toHaveBeenCalled();
});

it("verifies a recovery token hash and rejects a non-recovery link", async () => {
  await openLink("/update-password?token_hash=first-use-hash&type=recovery");
  await waitFor(() => expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "first-use-hash", type: "recovery" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Reset password" }).hasAttribute("disabled")).toBe(false));
  cleanup();
  auth.listener = null;
  window.history.replaceState(null, "", "/update-password?token_hash=invite-hash&type=invite");
  render(<UpdatePasswordPage />);
  expect(await screen.findByRole("heading", { name: "Password Reset Link Expired" })).toBeTruthy();
});

it("shows a recovery-specific expired state for an invalid or reused code", async () => {
  auth.initialize.mockResolvedValueOnce({ error: new Error("expired") });
  await openLink("/update-password?code=used-code&flow=recovery");
  expect(await screen.findByRole("heading", { name: "Password Reset Link Expired" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Request New Reset Link" }).getAttribute("href")).toBe("/forgot-password");
});

it("validates matching passwords and shows the success screen after update", async () => {
  const post = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updated: true }) });
  vi.stubGlobal("fetch", post);
  const user = userEvent.setup();
  await openLink("/update-password?code=first-use-code");
  await act(async () => { auth.listener?.("PASSWORD_RECOVERY", { access_token: "test" }); });
  await waitFor(() => expect(screen.getByRole("button", { name: "Reset password" }).hasAttribute("disabled")).toBe(false));
  await user.type(screen.getByPlaceholderText("Enter new password"), "RiverCedar84!Bright");
  await user.type(screen.getByPlaceholderText("Confirm new password"), "DifferentRiver84!Bright");
  await user.click(screen.getByRole("button", { name: "Reset password" }));
  expect(screen.getByText("Password and confirm password must match")).toBeTruthy();
  expect(post).not.toHaveBeenCalled();
  await user.clear(screen.getByPlaceholderText("Confirm new password"));
  await user.type(screen.getByPlaceholderText("Confirm new password"), "RiverCedar84!Bright");
  await user.click(screen.getByRole("button", { name: "Reset password" }));
  expect(await screen.findByRole("heading", { name: "Password Reset Successful" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to Login" }).getAttribute("href")).toBe("/login");
  expect(post).toHaveBeenCalledTimes(1);
});
