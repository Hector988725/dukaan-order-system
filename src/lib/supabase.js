import { createClient } from "@supabase/supabase-js";

// ============================================================
// YAHAN APNI SUPABASE KEYS DAALEIN
// ============================================================
// Supabase project banane ke baad:
// 1. Project Settings -> API mein jaayein
// 2. "Project URL" copy karke neeche paste karein
// 3. "anon public" key copy karke neeche paste karein
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "YAHAN_APNA_PROJECT_URL_DAALEIN";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YAHAN_APNI_ANON_KEY_DAALEIN";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Store ka slug (URL naam) - yeh batata hai kis dukaan ka data load karna hai
// Abhi single store ke liye hardcoded hai, future mein URL se automatic aayega
export const STORE_SLUG = "sharma-kirana";
