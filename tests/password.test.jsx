import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { checkPassword, passwordError } from "../src/lib/password";
import PasswordMeter from "../src/components/PasswordMeter";

describe("password policy", () => {
  it.each(["123456", "password", "Password1", "abcdefgh", "ABCDEFGH1!", "Abcdefg1", "Aaaa1111!", "Qwerty@123", "Abcde@12345"])("rejects %s", (p) => {
    expect(checkPassword(p).ok).toBe(false);
  });
  it.each(["Tm7#kLp2Qx", "Sabzi&Dukaan#2026x", "R!ver9Stone"])("accepts %s", (p) => {
    expect(checkPassword(p).ok).toBe(true);
  });
  it("12+ chars is Strong, 8-11 is Good", () => {
    expect(checkPassword("Tm7#kLp2Qxzz").level).toBe(3);
    expect(checkPassword("Tm7#kLp2").level).toBe(2);
  });
  it("rejects password containing the email name", () => {
    expect(checkPassword("Hector#9921x", { email: "hector@gmail.com" }).ok).toBe(false);
    expect(checkPassword("Tm7#kLp2Qx", { email: "hector@gmail.com" }).ok).toBe(true);
  });
  it("passwordError message", () => {
    expect(passwordError("abc")).toMatch(/not strong enough/);
    expect(passwordError("Tm7#kLp2Qx")).toBe("");
  });
  it("meter renders checklist + label", () => {
    const h = renderToStaticMarkup(<PasswordMeter password="abc" />);
    expect(h).toContain("Weak"); expect(h).toContain("At least 8 characters");
    expect(renderToStaticMarkup(<PasswordMeter password="Tm7#kLp2Qxzz" />)).toContain("Strong");
  });
});
