// ============================================================
// Edge Function: staff-login
// Dukaandar apne staff ka MOBILE + PASSWORD login banata hai — staff ko email,
// Gmail, confirmation link ya code kuch nahi chahiye.
//
// Actions (sab owner ke login token se, "Verify JWT" = ON):
//   create : { action:"create", staff_id, phone? }  -> naya login, password ek baar lautata hai
//   reset  : { action:"reset",  staff_id }          -> naya password (sirf isi tareeke se bane login ka)
//
// Security:
//  - Caller us dukaan ka owner hona chahiye jiska ye staff hai.
//  - Fake email sirf "s<mobile>@staff.dukaan.local" — kabhi mail nahi jaati.
//  - reset sirf unhi accounts par chalta hai jinki email @staff.dukaan.local hai
//    (kisi asli email wale account ka password owner nahi badal sakta).
//  - Password 8 akshar random (A-Z, 2-9; confusing akshar nahi), ek hi baar dikhta hai.
//
// DEPLOY: Dashboard -> Edge Functions -> Create "staff-login" -> paste -> Deploy. Verify JWT = ON.
// SECRETS: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (default available)
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DOMAIN = "staff.dukaan.local";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function makePassword(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
const emailFor = (phone: string) => `s${phone}@${DOMAIN}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Caller login
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = token ? await admin.auth.getUser(token) : { data: null, error: new Error("no token") };
    const caller = userData?.user;
    if (userErr || !caller) return json({ error: "Login zaroori hai" }, 401);

    // 2. Input
    const body = await req.json();
    const action = String(body.action || "");
    const staffId = String(body.staff_id || "");
    if (!["create", "reset"].includes(action)) return json({ error: "Galat action" }, 400);
    if (!staffId) return json({ error: "staff_id zaroori hai" }, 400);

    // 3. Staff + ownership
    const { data: staff } = await admin
      .from("shop_staff").select("id, store_id, name, phone, user_id, is_active").eq("id", staffId).maybeSingle();
    if (!staff) return json({ error: "Staff nahi mila" }, 404);
    const { data: store } = await admin.from("stores").select("id, user_id").eq("id", staff.store_id).maybeSingle();
    if (!store || store.user_id !== caller.id) return json({ error: "Staff nahi mila" }, 404);

    if (action === "create") {
      if (staff.user_id) return json({ error: "Is staff ka login pehle se bana hua hai. Naya password chahiye to 'Password Reset' dabayein." }, 400);

      let phone = String(staff.phone || "").replace(/\D/g, "");
      if (phone.length !== 10) phone = String(body.phone || "").replace(/\D/g, "");
      if (phone.length !== 10) return json({ error: "10 digit ka mobile number zaroori hai" }, 400);

      const password = makePassword();
      const email = emailFor(phone);
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { staff_login: true },
      });
      if (createErr || !created?.user) {
        const taken = /already|registered|exists/i.test(createErr?.message || "");
        return json({ error: taken ? "Is mobile number se pehle se ek staff login bana hua hai (shayad kisi aur dukaan me)." : "Login nahi ban paaya. Dobara try karein." }, taken ? 409 : 500);
      }

      const { error: linkErr } = await admin
        .from("shop_staff").update({ user_id: created.user.id, phone, invite_code: null, invite_expires_at: null })
        .eq("id", staff.id).is("user_id", null);
      if (linkErr) {
        await admin.auth.admin.deleteUser(created.user.id); // adhura login saaf
        return json({ error: "Staff se link nahi ho paaya. Dobara try karein." }, 500);
      }
      return json({ ok: true, phone, password });
    }

    // reset
    if (!staff.user_id) return json({ error: "Pehle login banayein" }, 400);
    const { data: au, error: auErr } = await admin.auth.admin.getUserById(staff.user_id);
    const email = au?.user?.email || "";
    if (auErr || !email.endsWith(`@${DOMAIN}`)) {
      return json({ error: "Is staff ne apne email se account banaya hai — uska password yahan se nahi badla ja sakta. 'Login Reset' se naya login banayein." }, 400);
    }
    const password = makePassword();
    const { error: updErr } = await admin.auth.admin.updateUserById(staff.user_id, { password });
    if (updErr) return json({ error: "Password nahi badal paaya. Dobara try karein." }, 500);
    return json({ ok: true, phone: email.slice(1, 11), password });
  } catch (_e) {
    return json({ error: "Kuch gadbad hui. Dobara try karein." }, 500);
  }
});
