// ============================================================
// BUSINESS TYPE THEMES
// ============================================================
// Har business type ka apna color palette, gradient, aur icon hai —
// customer ko dekhte hi pata chal jaana chahiye ki yeh kirana hai ya
// medical ya kapdo ki dukaan. Naya business type add karna ho to bas
// yahan ek entry add karein, baaki jagah (signup dropdown, header,
// buttons) khud-ba-khud update ho jayengi.
//
// "primary" aur "primaryDark" milke header mein ek subtle gradient
// banate hain (flat single color se zyada rich/premium lagta hai).
// "badge" field special-case hai — "cross" ka matlab hai white circle
// ke andar bold red plus-sign, jo India mein medical store ka
// universal, turant-pehchana-jaane wala symbol hai (MedPlus, Apollo,
// Jan Aushadhi jaisi dukaano mein bhi yahi convention hai) — isliye
// yahan generic icon ki jagah yeh khaas treatment diya hai.
// ============================================================

export const BUSINESS_THEMES = {
  kirana: {
    label: "Kirana / Grocery",
    primary: "#1B4332",
    primaryDark: "#123026",
    accent: "#D4A24C",
    accentDark: "#B37F2E",
    icon: "Store",
  },
  medical: {
    label: "Medical / Pharmacy",
    primary: "#0F5C73",
    primaryDark: "#0A3F4F",
    accent: "#4FB6A6",
    accentDark: "#33917F",
    icon: "Pill",
    badge: "cross", // white circle + bold red plus — Indian pharmacy convention
  },
  hardware: {
    label: "Hardware Shop",
    primary: "#8A4A1F",
    primaryDark: "#5A2F12",
    accent: "#E0812F",
    accentDark: "#B35F1D",
    icon: "Wrench",
  },
  mobile: {
    label: "Mobile / Electronics",
    primary: "#22314F",
    primaryDark: "#141D30",
    accent: "#4CC9F0",
    accentDark: "#2A93B5",
    icon: "Smartphone",
  },
  clothing: {
    label: "Kapde / Boutique",
    primary: "#6B1E3A",
    primaryDark: "#471326",
    accent: "#D4A24C",
    accentDark: "#B37F2E",
    icon: "Shirt",
  },
  stationery: {
    label: "Stationery / Books",
    primary: "#2C3E66",
    primaryDark: "#1B2844",
    accent: "#E8B84B",
    accentDark: "#C99A2E",
    icon: "BookOpen",
  },
  bakery: {
    label: "Bakery / Mithai",
    primary: "#8A4A26",
    primaryDark: "#5C2F17",
    accent: "#F0A86E",
    accentDark: "#D1824A",
    icon: "Cake",
  },
  salon: {
    label: "Salon / Beauty Parlour",
    primary: "#5B2A5E",
    primaryDark: "#3D1B40",
    accent: "#E8A3B0",
    accentDark: "#C97A8A",
    icon: "Scissors",
  },
  restaurant: {
    label: "Restaurant / Dhaba",
    primary: "#8A1F1F",
    primaryDark: "#5C1414",
    accent: "#E0A93A",
    accentDark: "#B8841F",
    icon: "UtensilsCrossed",
  },
  footwear: {
    label: "Jute / Footwear Shop",
    primary: "#3E3226",
    primaryDark: "#261F18",
    accent: "#C98A4B",
    accentDark: "#A66B34",
    icon: "Footprints",
  },
  general: {
    label: "Koi Aur Business",
    primary: "#1B4332",
    primaryDark: "#123026",
    accent: "#D4A24C",
    accentDark: "#B37F2E",
    icon: "Store",
  },
};

export function getTheme(businessType) {
  return BUSINESS_THEMES[businessType] || BUSINESS_THEMES.general;
}

// Header ke liye ek subtle diagonal gradient — flat single color se
// zyada rich/premium lagta hai, bina kisi image/asset ke.
export function getHeaderBackground(theme) {
  return `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`;
}

// Signup dropdown ke liye list format
export const BUSINESS_TYPE_LIST = Object.entries(BUSINESS_THEMES).map(([id, t]) => ({ id, label: t.label }));
