// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/components/franchise/Franchise.module.css", () => ({ default: new Proxy({}, { get: (_target, key) => String(key) }) }));

import { LoggedInManagers } from "@/components/franchise/LoggedInManagers";

afterEach(cleanup);

it("moves through today's managers without changing the total", () => {
  render(<LoggedInManagers managers={[{ id: "1", name: "Amina" }, { id: "2", name: "Bongani" }, { id: "3", name: "Thandi" }]} activeManagers={5} />);
  const previous = screen.getByRole("button", { name: "Previous manager" });
  const next = screen.getByRole("button", { name: "Next manager" });
  expect(screen.getByText("Amina")).toBeTruthy();
  expect(previous.hasAttribute("disabled")).toBe(true);
  fireEvent.click(next);
  expect(screen.getByText("Bongani")).toBeTruthy();
  fireEvent.click(next);
  expect(screen.getByText("Thandi")).toBeTruthy();
  expect(next.hasAttribute("disabled")).toBe(true);
  fireEvent.click(previous);
  expect(screen.getByText("Bongani")).toBeTruthy();
  expect(screen.getByText("5")).toBeTruthy();
  expect(screen.getByText("3")).toBeTruthy();
});

it("hides navigation when there is at most one manager", () => {
  const view = render(<LoggedInManagers managers={[]} activeManagers={0} />);
  expect(screen.getByText("No manager logins recorded today")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<LoggedInManagers managers={[{ id: "1", name: "Amina" }]} activeManagers={1} />);
  expect(screen.getByText("Amina")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
