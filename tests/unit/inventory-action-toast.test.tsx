// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InventoryActionToast, useInventoryActionToast } from "@/components/manager/forms/InventoryActionToast";

function ToastHarness() {
  const { notice, show, dismiss } = useInventoryActionToast();
  return <>
    <button onClick={() => show("success", "Product Added Successfully", "Your new product has been successfully added to your inventory.")}>Product saved</button>
    <button onClick={() => show("success", "Stock Updated Successfully", "Your inventory quantity has been updated successfully.")}>Stock saved</button>
    <button onClick={() => show("error", "Product Could Not Be Added", "The product could not be saved.")}>Product failed</button>
    <InventoryActionToast notice={notice} onDismiss={dismiss} />
  </>;
}

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("announces confirmed product creation, then closes manually without changing the page", () => {
  vi.useFakeTimers();
  render(<ToastHarness />);
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Product saved" }));
  expect(screen.getByRole("status").textContent).toContain("Product Added Successfully");
  expect(screen.getByRole("status").textContent).toContain("Your new product has been successfully added to your inventory.");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
  act(() => vi.advanceTimersByTime(180));
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("button", { name: "Product saved" })).toBeTruthy();
});

it("shows distinct stock and error messages and dismisses after six seconds", () => {
  vi.useFakeTimers();
  render(<ToastHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Stock saved" }));
  expect(screen.getByRole("status").textContent).toContain("Stock Updated Successfully");
  act(() => vi.advanceTimersByTime(6000));
  act(() => vi.advanceTimersByTime(180));
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Product failed" }));
  expect(screen.getByRole("alert").textContent).toContain("The product could not be saved.");
});
