// ============================================================
// friendlyError(e, lang) — kisi bhi error ko dukaandar ke samajhne layak
// message me badalta hai. Technical Supabase/Postgres/Network text kabhi
// seedha screen par nahi aana chahiye.
//  - Jo message humne khud (RPC/edge function me) likha hai ("Staff ka naam
//    daalein", "Aapka plan expire ho gaya hai...") wo jaisa hai waisa dikhta hai.
//  - Sirf technical dikhne wale messages badle jaate hain.
// lang: "hi" (default, Hinglish) ya "en".
// ============================================================
const T = {
  network: ["Internet connection check karein aur dobara try karein.", "Please check your internet connection and try again."],
  session: ["Aapka login session khatam ho gaya hai. Dobara login karein.", "Your session has expired. Please log in again."],
  badLogin: ["Email ya password galat hai.", "Incorrect email or password."],
  unconfirmed: ["Pehle apna email confirm karein (mail me link aaya hoga).", "Please confirm your email first (check your inbox)."],
  exists: ["Is email se account pehle se bana hua hai. Login karein.", "An account with this email already exists. Please log in."],
  denied: ["Aapko ye karne ki permission nahi hai.", "You don't have permission to do this."],
  duplicate: ["Ye pehle se maujood hai. Alag naam ya value try karein.", "This already exists. Please try a different name or value."],
  linked: ["Ye kisi aur record se juda hua hai, isliye abhi nahi ho sakta.", "This is linked to other records, so it can't be done right now."],
  missing: ["Kuch zaroori jaankari bhari nahi gayi. Sab fields check karein.", "Some required information is missing. Please check all fields."],
  invalid: ["Dali gayi value sahi nahi hai. Check karke dobara try karein.", "The value entered isn't valid. Please check and try again."],
  rate: ["Bahut zyada koshish ho gayi. Thodi der baad try karein.", "Too many attempts. Please try again in a little while."],
  busy: ["Server abhi busy hai. Thodi der baad dobara try karein.", "The server is busy. Please try again in a little while."],
  tech: ["Kuch technical gadbad hui. Dobara try karein, na ho to support ko batayein.", "Something went wrong on our side. Please try again, or contact support."],
  bigFile: ["File bahut badi hai. Chhoti file try karein.", "The file is too large. Please try a smaller file."],
  generic: ["Kuch gadbad hui. Dobara try karein.", "Something went wrong. Please try again."],
};

const RULES = [
  [/failed to fetch|networkerror|network request failed|load failed|err_internet|offline/i, "network"],
  [/invalid login credentials/i, "badLogin"],
  [/email not confirmed/i, "unconfirmed"],
  [/user already registered|already been registered/i, "exists"],
  [/jwt expired|invalid jwt|jwt|refresh token|session (expired|missing|not found)|auth session missing|not authenticated|login session/i, "session"],
  [/row-level security|violates row-level|permission denied|42501|not authorized|insufficient.?privilege/i, "denied"],
  [/duplicate key|unique constraint|already exists|23505/i, "duplicate"],
  [/foreign key|23503/i, "linked"],
  [/null value in column|not-null constraint|23502/i, "missing"],
  [/check constraint|invalid input syntax|out of range|value too long|22001|22003|22p02|23514/i, "invalid"],
  [/payload too large|exceeded the maximum allowed size|file size|entity too large|413/i, "bigFile"],
  [/rate limit|too many requests|over_.*rate|429/i, "rate"],
  [/timeout|timed out|statement timeout|\b50[234]\b|upstream|bad gateway|service unavailable/i, "busy"],
  [/pgrst|does not exist|schema cache|could not find the|undefined_function|42883|42p01|42703|syntax error at|relation ".*"|column ".*"|violates|sqlstate|internal server error|\bat line\b|\{"|^\[object/i, "tech"],
];

export function friendlyError(e, lang = "hi") {
  const i = lang === "en" ? 1 : 0;
  const raw = typeof e === "string" ? e : (e && (e.message || e.error_description || e.error)) || "";
  const msg = String(raw).trim();
  if (!msg) return T.generic[i];
  for (const [re, key] of RULES) if (re.test(msg)) return T[key][i];
  if (msg.length > 220) return T.tech[i];
  return msg; // humara apna likha hua (readable) message jaisa hai waisa
}
