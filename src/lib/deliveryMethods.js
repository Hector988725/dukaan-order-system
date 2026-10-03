// ============================================================
// DELIVERY METHODS — delivery ka tareeka (order status / payment
// status / delivery status se bilkul ALAG field: delivery_assignments.
// delivery_method). Abhi sirf SHOP_DELIVERY implemented hai. Baaki
// do ka sirf architecture ready hai (registry entry + DB field) —
// koi API call, fake credentials ya fake tracking data nahi.
//
// Naya provider jodne ke liye: yahan entry (implemented: true) +
// server-side RPC/edge-function adapter. UI sirf wahi methods dikhata
// hai jo implemented AUR store ke liye enabled hon.
// ============================================================
export const DELIVERY_METHODS = {
  SHOP_DELIVERY: {
    id: "SHOP_DELIVERY",
    label: "Shop Delivery",
    description: "Apne delivery boys se delivery",
    implemented: true,
  },
  LOCAL_PARTNER: {
    id: "LOCAL_PARTNER",
    label: "Local Delivery Partner",
    description: "Future: partner network (partner ko sirf zaroori order info milegi)",
    implemented: false,
  },
  SHIPROCKET: {
    id: "SHIPROCKET",
    label: "Shiprocket",
    description: "Future: courier shipping provider",
    implemented: false,
  },
};

export const DELIVERY_STATUS_FLOW = ["ASSIGNED", "ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"];

export const DELIVERY_STATUS_META = {
  ASSIGNED: { label: "Assigned", color: "#9A6B00", bg: "#FFF4DB" },
  ACCEPTED: { label: "Accepted", color: "#1F5FA8", bg: "#E4EEF9" },
  PICKED_UP: { label: "Picked Up", color: "#5B2A5E", bg: "#F3E6F0" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "#1B4332", bg: "#E7F0EA" },
  DELIVERED: { label: "Delivered", color: "#1B4332", bg: "#D5EBDD" },
};

// Sirf agla valid action (skip nahi hota)
export const NEXT_DELIVERY_ACTION = {
  ASSIGNED: { to: "ACCEPTED", label: "Accept Karein" },
  ACCEPTED: { to: "PICKED_UP", label: "Order Pick Kar Liya" },
  PICKED_UP: { to: "OUT_FOR_DELIVERY", label: "Delivery Ke Liye Nikla" },
  OUT_FOR_DELIVERY: { to: "DELIVERED", label: "Delivered Mark Karein" },
};

// Orders mein lat/lng store nahi hota — address se device ki map app khulti hai
export function mapsUrl(d) {
  const q = [d.address, d.landmark, d.pincode].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
