import { createClient } from "@supabase/supabase-js";

// ============================================================
// YAHAN APNI SUPABASE KEYS DAALEIN
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Agar deployment (Vercel) mein VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// environment variables missing ya khaali hon, to createClient() ek invalid
// URL (jaise placeholder text) ke saath turant (module load time par hi)
// "Invalid supabaseUrl" error throw karta tha — jisse poori React app crash
// ho jaati thi aur browser mein sirf ek BLANK WHITE PAGE dikhta tha (React
// kabhi mount hi nahi hota tha). Ab hum ye check pehle khud karte hain, taaki
// crash kabhi na ho, aur App.jsx ek clear error screen dikha sake.
export const isSupabaseConfigured = /^https?:\/\//i.test(SUPABASE_URL) && !!SUPABASE_ANON_KEY;

export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : "https://placeholder.supabase.co",
  isSupabaseConfigured ? SUPABASE_ANON_KEY : "placeholder-anon-key"
);

// URL se store ka slug nikalna - jaise /sharma-kirana se "sharma-kirana"
// Agar URL mein kuch nahi hai (sirf homepage), toh null return hota hai
export function getSlugFromUrl() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, ""); // leading/trailing slashes hatao
  if (!path || path === "" || path === "signup" || path === "login" || path === "create-store") return null;
  return path;
}
