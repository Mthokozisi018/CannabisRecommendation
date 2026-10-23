// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/DashboardBackdrop", () => ({ DashboardBackdrop: () => null }));
vi.mock("@/components/manager/StoreRegistrationQR", () => ({ StoreRegistrationQR: () => null }));
vi.mock("@/components/LoadingOverlay", () => ({ LoadingOverlay: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));

import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { StaffCustomerOnboarding } from "@/components/registration/StaffCustomerOnboarding";
import { CustomerRegistrationForm } from "@/app/customer/register/CustomerRegistrationForm";

afterEach(() => cleanup());

it("keeps separate native agreements and lets the legal link open without accepting one", async () => {
  const user = userEvent.setup();
  window.scrollTo = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  render(<RegistrationForm token={"a".repeat(64)} storeName="Test Store" />);

  const terms = screen.getByRole("checkbox", { name: /I agree to the Customer Terms & Conditions/i });
  const privacy = screen.getByRole("checkbox", { name: /I have read the Privacy Notice/i });
  const verification = screen.getByRole("checkbox", { name: /I have read the ID Verification Notice/i });
  for (const input of [terms, privacy, verification]) {
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect((input as HTMLInputElement).required).toBe(true);
    expect((input as HTMLInputElement).checked).toBe(false);
  }

  await user.click(screen.getByRole("link", { name: "Customer Terms & Conditions" }));
  expect((terms as HTMLInputElement).checked).toBe(false);
  expect(screen.getByRole("dialog").getAttribute("open")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "Back to Registration" }));
  await user.click(screen.getByText("I agree to the", { exact: false }));
  expect((terms as HTMLInputElement).checked).toBe(true);
  expect((privacy as HTMLInputElement).checked).toBe(false);

  terms.focus();
  await user.keyboard(" ");
  expect((terms as HTMLInputElement).checked).toBe(false);
});

it("keeps customer account agreements separate and optional marketing unchecked", async () => {
  const user = userEvent.setup();
  render(<CustomerRegistrationForm />);
  const terms = screen.getByRole("checkbox", { name: /I accept the Terms and Conditions/i }) as HTMLInputElement;
  const privacy = screen.getByRole("checkbox", { name: /I accept the Privacy Policy/i }) as HTMLInputElement;
  const physicalId = screen.getByRole("checkbox", { name: /valid physical ID/i }) as HTMLInputElement;
  const marketing = screen.getByRole("checkbox", { name: /optional GreenChoice/i }) as HTMLInputElement;
  expect(terms.required && privacy.required && physicalId.required).toBe(true);
  expect(marketing.required).toBe(false);
  await user.click(terms.closest("label")!);
  expect(terms.checked).toBe(true);
  expect(privacy.checked).toBe(false);
  expect(marketing.checked).toBe(false);
});

it("shows the same registration agreements in the receptionist flow", async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ link: `http://localhost/register/${"a".repeat(64)}`, storeName: "Test Store" })
  }));
  const user = userEvent.setup();
  render(<StaffCustomerOnboarding />);
  await user.click(screen.getByRole("button", { name: "Register Customer" }));
  expect(await screen.findByRole("heading", { name: "Customer Registration" })).toBeTruthy();
  expect(screen.getByText("Test Store", { exact: true })).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: /I agree to the Customer Terms & Conditions/i })).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: /I have read the Privacy Notice/i })).toBeTruthy();
  vi.unstubAllGlobals();
});
