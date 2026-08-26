// ============================================================
// BUSINESS TYPE THEMES
// ============================================================
// Har business type ka apna color palette aur icon hai — customer
// ko dekhte hi pata chal jaana chahiye ki yeh kirana hai ya medical
// ya kapdo ki dukaan. Naya business type add karna ho to bas yahan
// ek entry add karein, baaki jagah (signup dropdown, header, buttons)
// khud-ba-khud update ho jayengi.
// ============================================================

export const BUSINESS_THEMES = {
  kirana: {
    label: "Kirana / Grocery",
    primary: "#1B4332",
    accent: "#D4A24C",
    icon: "Store",
  },
  medical: {
    label: "Medical / Pharmacy",
    primary: "#0F5C73",
    accent: "#4FB6A6",
    icon: "Pill",
  },
  hardware: {
    label: "Hardware Shop",
    primary: "#5A4433",
    accent: "#E0812F",
    icon: "Wrench",
  },
  mobile: {
    label: "Mobile / Electronics",
    primary: "#22314F",
    accent: "#4CC9F0",
    icon: "Smartphone",
  },
  clothing: {
    label: "Kapde / Boutique",
    primary: "#6B1E3A",
    accent: "#D4A24C",
    icon: "Shirt",
  },
  stationery: {
    label: "Stationery / Books",
    primary: "#2C3E66",
    accent: "#E8B84B",
    icon: "BookOpen",
  },
  bakery: {
    label: "Bakery / Mithai",
    primary: "#6B3A1F",
    accent: "#F0A86E",
    icon: "Cake",
  },
  salon: {
    label: "Salon / Beauty Parlour",
    primary: "#5B2A5E",
    accent: "#E8A3B0",
    icon: "Scissors",
  },
  restaurant: {
    label: "Restaurant / Dhaba",
    primary: "#7A1F1F",
    accent: "#E0A93A",
    icon: "UtensilsCrossed",
  },
  footwear: {
    label: "Jute / Footwear Shop",
    primary: "#3E3226",
    accent: "#C98A4B",
    icon: "Footprints",
  },
  general: {
    label: "Koi Aur Business",
    primary: "#1B4332",
    accent: "#D4A24C",
    icon: "Store",
  },
};

export function getTheme(businessType) {
  return BUSINESS_THEMES[businessType] || BUSINESS_THEMES.general;
}

// Signup dropdown ke liye list format
export const BUSINESS_TYPE_LIST = Object.entries(BUSINESS_THEMES).map(([id, t]) => ({ id, label: t.label }));
