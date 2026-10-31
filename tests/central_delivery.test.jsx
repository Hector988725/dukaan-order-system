import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const rpcCalls = [];
vi.mock("../src/lib/supabase", () => ({
  supabase: { rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: name === "get_central_delivery_status" ? true : [], error: null }; } },
}));

import { PoolCard, DeliveryCard } from "../src/components/RiderApp.jsx";
import {
  fetchCentralDeliveryAllowed, requestCentralDelivery, cancelCentralDelivery, centralAccept,
  centralRelease, centralUpdateStatus, fetchCentralPool, fetchMyCentralDeliveries,
} from "../src/lib/api.js";

beforeEach(() => { rpcCalls.length = 0; });

const pool = {
  assignment_id: "a1", order_number: "A1", store_name: "Rich Mart", store_address: "Main Rd", store_city: "Anuppur",
  drop_pincode: "484224", item_count: 3, total: 500, delivery_fee: 20, payment_method: "COD", amount_to_collect: 500,
  order_status: "Ready", requested_at: new Date().toISOString(),
  // pichhle (galat) server se aa bhi jaye to UI ko ye dikhana nahi chahiye
  customer_name: "SECRET CUSTOMER", customer_phone: "9999999999", address: "SECRET ADDRESS",
};
const mine = (over) => ({
  assignment_id: "a1", order_number: "A1", status: "ACCEPTED", store_name: "Rich Mart", store_address: "Main Rd", store_phone: "9111111111",
  customer_name: "Cust One", customer_phone: "9999999999", address: "12 Gandhi Road", landmark: "", pincode: "484224",
  items: [], total: 500, payment_method: "COD", amount_to_collect: 500, ...over,
});

describe("Rider app privacy", () => {
  it("pool card shows store, pincode and COD but never customer name/phone/address", () => {
    const h = renderToStaticMarkup(<PoolCard p={pool} onChanged={() => {}} onAccepted={() => {}} />);
    expect(h).toContain("Rich Mart");
    expect(h).toContain("484224");
    expect(h).toContain("₹500");
    expect(h).not.toContain("SECRET CUSTOMER");
    expect(h).not.toContain("9999999999");
    expect(h).not.toContain("SECRET ADDRESS");
  });
  it("accepted (before pickup): pickup from store first, customer address not shown", () => {
    const h = renderToStaticMarkup(<DeliveryCard d={mine()} onChanged={() => {}} />);
    expect(h).toContain("Pehle dukaan se saman uthayein");
    expect(h).toContain("Order Pick Kar Liya");
    expect(h).not.toContain("12 Gandhi Road");
    expect(h).toContain("Wapas Pool Mein Bhejein");
  });
  it("out for delivery: customer details + COD + Delivered action, no release", () => {
    const h = renderToStaticMarkup(<DeliveryCard d={mine({ status: "OUT_FOR_DELIVERY" })} onChanged={() => {}} />);
    expect(h).toContain("Cust One");
    expect(h).toContain("12 Gandhi Road");
    expect(h).toContain("Delivered Mark Karein");
    expect(h).not.toContain("Wapas Pool Mein Bhejein");
    expect(h).toContain("Amount to Collect (COD)");
  });
  it("paid online order shows PAID ONLINE", () => {
    const h = renderToStaticMarkup(<DeliveryCard d={mine({ status: "PICKED_UP", payment_method: "UPI", amount_to_collect: 0 })} onChanged={() => {}} />);
    expect(h).toContain("PAID ONLINE");
  });
});

describe("Central delivery api -> correct RPCs", () => {
  it("owner and rider calls map to the right RPC and params", async () => {
    await fetchCentralDeliveryAllowed("s1");
    await requestCentralDelivery("o1");
    await cancelCentralDelivery("o1");
    await fetchCentralPool();
    await centralAccept("a1");
    await centralRelease("a1");
    await centralUpdateStatus("a1", "PICKED_UP");
    await fetchMyCentralDeliveries("history", "f", "t");
    expect(rpcCalls).toEqual([
      { name: "get_central_delivery_status", args: { p_store_id: "s1" } },
      { name: "request_central_delivery", args: { p_order_id: "o1" } },
      { name: "cancel_central_delivery", args: { p_order_id: "o1" } },
      { name: "get_central_pool", args: undefined },
      { name: "central_accept", args: { p_assignment_id: "a1" } },
      { name: "central_release", args: { p_assignment_id: "a1" } },
      { name: "central_update_status", args: { p_assignment_id: "a1", p_new_status: "PICKED_UP" } },
      { name: "get_my_central_deliveries", args: { p_scope: "history", p_from: "f", p_to: "t" } },
    ]);
  });
});

import CentralDeliveryPanel, { scopeFromValue } from "../src/components/CentralDeliveryPanel.jsx";
describe("Central delivery panel (partner vs admin)", () => {
  it("only Super Admin sees the Partners tab", () => {
    expect(renderToStaticMarkup(<CentralDeliveryPanel isAdmin />)).toContain("Partners");
    const h = renderToStaticMarkup(<CentralDeliveryPanel />);
    expect(h).toContain("Live Deliveries");
    expect(h).not.toContain(">Partners<");
  });
  it("scope dropdown values map to server scope", () => {
    expect(scopeFromValue("all")).toEqual({ partner: null, head: false });
    expect(scopeFromValue("head")).toEqual({ partner: null, head: true });
    expect(scopeFromValue("abc")).toEqual({ partner: "abc", head: false });
  });
});
