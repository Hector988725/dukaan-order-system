import { describe, it, expect } from "vitest";
import { shouldShowSplash } from "../src/components/BrandSplash.jsx";

const base = { path: "/", standalone: false, seen: false, reducedMotion: false };
describe("shouldShowSplash", () => {
  it("shows on home and role apps", () => {
    for (const p of ["/", "/staff", "/distributor", "/rider/", "/superadmin"]) expect(shouldShowSplash({ ...base, path: p })).toBe(true);
  });
  it("not on a customer shop link or other pages in a browser", () => {
    for (const p of ["/richmart", "/demo", "/terms", "/aao"]) expect(shouldShowSplash({ ...base, path: p })).toBe(false);
  });
  it("installed app shows on any path", () => expect(shouldShowSplash({ ...base, path: "/richmart", standalone: true })).toBe(true));
  it("only once per session", () => expect(shouldShowSplash({ ...base, seen: true })).toBe(false));
  it("respects reduced motion", () => expect(shouldShowSplash({ ...base, reducedMotion: true })).toBe(false));
});
