import { createClient } from "@supabase/supabase-js";

// ============================================================
// YAHAN APNI SUPABASE KEYS DAALEIN
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "YAHAN_APNA_PROJECT_URL_DAALEIN";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YAHAN_APNI_ANON_KEY_DAALEIN";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// URL se store ka slug nikalna - jaise /sharma-kirana se "sharma-kirana"
// Agar URL mein kuch nahi hai (sirf homepage), toh null return hota hai
export function getSlugFromUrl() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, ""); // leading/trailing slashes hatao
  if (!path || path === "" || path === "signup" || path === "login" || path === "create-store") return null;
  return path;
}
