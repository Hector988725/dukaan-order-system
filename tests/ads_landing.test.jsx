import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdsLanding from "../src/components/AdsLanding.jsx";

function renderWith(search) {
  globalThis.window = { location: { search } };
  return renderToStaticMarkup(<AdsLanding />);
}
afterEach(() => { delete globalThis.window; });

describe("AdsLanding", () => {
  it("shows pitch, price, signup and demo links", () => {
    const html = renderWith("");
    expect(html).toContain("₹199");
    expect(html).toContain('href="/?signup=1"');
    expect(html).toContain('href="/demo"');
    expect(html).not.toContain("KE DUKANDARON KE LIYE");
  });
  it("shows city from ?c=", () => {
    expect(renderWith("?c=anuppur")).toContain("ANUPPUR KE DUKANDARON KE LIYE");
  });
  it("junk in city param is stripped", () => {
    const html = renderWith("?c=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    expect(html).not.toContain("<script>");
  });
});
