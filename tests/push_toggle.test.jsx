import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("../src/lib/push", () => ({
  pushState: vi.fn(async () => "off"), enablePush: vi.fn(), disablePush: vi.fn(), enableCustomerPush: vi.fn(), pushOnLogout: vi.fn(),
}));
import PushToggle from "../src/components/PushToggle";
describe("PushToggle", () => {
  it("renders nothing until the state is known (SSR first paint)", () => {
    expect(renderToStaticMarkup(<PushToggle role="owner" />)).toBe("");
  });
});
