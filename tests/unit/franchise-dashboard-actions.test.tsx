// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, prefetch, ...props }: React.ComponentProps<"a"> & { prefetch?: boolean }) => <a {...props} data-prefetch={prefetch ? "true" : undefined}>{children}</a>
}));
vi.mock("@/lib/franchise/data", () => ({
  getFranchiseHome: async () => ({
    session: { profile: { first_name: "Fixture" }, displayName: "Fixture" },
    franchise: { name: "Fixture Franchise" },
    salesToday: 0,
    loggedIn: [],
    activeManagers: 0
  })
}));
vi.mock("@/components/franchise/Franchise.module.css", () => ({ default: new Proxy({}, { get: (_target, key) => String(key) }) }));

import FranchiseHomePage from "@/app/dashboard/franchise/page";

afterEach(cleanup);

it("reuses Manager action cards for four ordered FA destinations and retains loading hooks", () => {
  render(<FranchiseHomePage />);
  const navigation = screen.getByRole("navigation", { name: "Franchise main navigation" });
  const links = within(navigation).getAllByRole("link");
  expect(links.map((link) => [link.getAttribute("aria-label"), link.getAttribute("href")])).toEqual([
    ["Add Store", "/dashboard/franchise/stores/new"],
    ["Manage Store", "/dashboard/franchise/stores"],
    ["Master Supply Management", "/dashboard/franchise/supply"],
    ["Sales and Performance", "/dashboard/franchise/sales"]
  ]);
  expect(links.every((link) => link.classList.contains("gc-manager-action-card"))).toBe(true);
  expect(links.map((link) => ["navEmerald", "navRoyalBlue", "navViolet", "navOrange"].find(tone => link.classList.contains(tone)))).toEqual([
    "navEmerald", "navRoyalBlue", "navViolet", "navOrange"
  ]);
  expect(links.every(link => link.classList.contains("franchiseNavCard") && !link.className.includes("hover:-translate-y-1"))).toBe(true);
  expect(links.map((link) => link.getAttribute("data-navigation-loading"))).toEqual([
    null, "franchise-stores", null, "franchise-sales"
  ]);
  expect(navigation.className).toContain("lg:grid-cols-4");
  expect(navigation.className).toContain("min-[361px]:grid-cols-2");
});
