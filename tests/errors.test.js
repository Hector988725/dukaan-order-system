import { describe, it, expect } from "vitest";
import { friendlyError } from "../src/lib/errors.js";

describe("friendlyError", () => {
  it("empty/None -> generic", () => {
    expect(friendlyError(null)).toMatch(/Kuch gadbad/);
    expect(friendlyError({ message: "  " })).toMatch(/Kuch gadbad/);
  });
  it("network", () => {
    expect(friendlyError(new Error("Failed to fetch"))).toMatch(/Internet/);
  });
  it("login", () => {
    expect(friendlyError({ message: "Invalid login credentials" })).toMatch(/password galat/);
  });
  it("RLS / permission -> denied", () => {
    expect(friendlyError({ message: 'new row violates row-level security policy for table "orders"' })).toMatch(/permission/);
  });
  it("technical text never leaks", () => {
    const m = friendlyError({ message: 'column "founding_member" does not exist' });
    expect(m).not.toMatch(/founding_member|column/);
    expect(friendlyError({ message: 'PGRST202 could not find the function' })).toMatch(/technical/);
  });
  it("our own readable message passes through", () => {
    expect(friendlyError({ message: "Staff ka naam daalein" })).toBe("Staff ka naam daalein");
  });
  it("very long unknown message -> tech", () => {
    expect(friendlyError({ message: "x".repeat(300) })).toMatch(/technical/);
  });
  it("english mode", () => {
    expect(friendlyError({ message: "Invalid login credentials" }, "en")).toMatch(/Incorrect email/);
  });
});
