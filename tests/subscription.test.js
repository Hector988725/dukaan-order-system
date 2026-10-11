import { describe, it, expect } from "vitest";
import { getRenewalState, RENEWAL_WINDOW_DAYS } from "../src/lib/subscription.js";

const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString();

describe("getRenewalState", () => {
  it("far from expiry -> active, not due", () => {
    const s = getRenewalState({ is_active: true, subscription_expires_at: inDays(20) });
    expect(s.active).toBe(true);
    expect(s.due).toBe(false);
  });
  it("inside renewal window -> due + expiringSoon", () => {
    const s = getRenewalState({ is_active: true, subscription_expires_at: inDays(RENEWAL_WINDOW_DAYS - 1) });
    expect(s.due).toBe(true);
    expect(s.expiringSoon).toBe(true);
  });
  it("expired -> inactive and due", () => {
    const s = getRenewalState({ is_active: true, subscription_expires_at: inDays(-2) });
    expect(s.active).toBe(false);
    expect(s.due).toBe(true);
  });
  it("is_active=false overrides a future expiry", () => {
    expect(getRenewalState({ is_active: false, subscription_expires_at: inDays(30) }).active).toBe(false);
  });
  it("demo/lifetime (2100) is active and never due", () => {
    const s = getRenewalState({ is_active: true, subscription_expires_at: "2100-01-01T00:00:00Z" });
    expect(s.isFree).toBe(true);
    expect(s.active).toBe(true);
    expect(s.due).toBe(false);
  });
  it("no expiry -> inactive", () => {
    expect(getRenewalState({}).active).toBe(false);
    expect(getRenewalState(null).active).toBe(false);
  });
});
