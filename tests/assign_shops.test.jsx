import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("../src/superadmin/api", () => ({
  fetchDistributorsOverview: vi.fn(async () => []), fetchStoreAreaSummary: vi.fn(async () => []),
  fetchStoresForAssignment: vi.fn(async () => ({ total: 0, rows: [] })), assignStores: vi.fn(), assignStoresByArea: vi.fn(),
}));
import AssignShopsPanel from "../src/superadmin/AssignShopsPanel";
describe("AssignShopsPanel", () => {
  it("renders English UI with controls", () => {
    const h = renderToStaticMarkup(<AssignShopsPanel />);
    expect(h).toContain("Give shops to a distributor");
    expect(h).toContain("Assign ALL unassigned in this area");
    expect(h).toContain("Also enable Central Delivery");
  });
});
