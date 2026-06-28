# Dukaan Order System - Deployment Guide

Yeh guide aapko **step-by-step** batayegi ki is system ko live kaise karna hai.
Koi coding knowledge ki zaroorat nahi — bas yeh steps follow karte jaayein.

Total time: **20-30 minute** (ek baar ka kaam)

---

## STEP 1: Supabase Account Banayein (Database ke liye)

1. Jaayein: **https://supabase.com**
2. "Start your project" pe click karein
3. GitHub ya Google se signup karein (free hai)
4. "New Project" pe click karein
5. Yeh details bharein:
   - **Name**: `dukaan-order-system` (ya kuch bhi naam)
   - **Database Password**: ek strong password banayein aur **kahin save kar lein**
   - **Region**: Singapore ya Mumbai (jo nearest ho)
6. "Create new project" pe click karein — 2 minute wait karein jab tak project ban jaaye

---

## STEP 2: Database Tables Banayein

1. Apne Supabase project ke andar, left side mein **"SQL Editor"** pe click karein
2. "New Query" pe click karein
3. Is project ke andar jo `schema.sql` file hai, uska **poora content copy** karein
4. Use SQL Editor mein **paste** karein
5. Right-bottom mein **"Run"** button pe click karein (ya Ctrl+Enter)
6. Agar "Success" dikhe, toh tables ban gaye hain ✅

Yeh schema automatically demo ke 8 products bhi daal dega testing ke liye.

---

## STEP 3: Apni API Keys Nikalein

1. Supabase project ke andar, left side mein **gear icon (Settings)** pe click karein
2. **"API"** section mein jaayein
3. Yahan 2 cheezein copy karni hain:
   - **Project URL** (jaise `https://abcdefgh.supabase.co`)
   - **anon public** key (ek lambi string hoti hai)

Yeh 2 values kahin safe jagah note kar lein — agle step mein chahiye honge.

---

## STEP 4: Apne Code Mein Keys Daalein

1. Is project ke folder ke andar `.env.example` file ko **`.env`** naam se rename/copy karein
2. Usme yeh likha milega:
   ```
   VITE_SUPABASE_URL=yahan_apna_supabase_project_url_daalein
   VITE_SUPABASE_ANON_KEY=yahan_apni_supabase_anon_key_daalein
   ```
3. Inko Step 3 wali apni real values se replace karein

---

## STEP 5: Vercel Pe Deploy Karein (Website Live Karne Ke Liye)

### Option A: GitHub Ke Through (Recommended)

1. **github.com** pe account banayein (agar nahi hai)
2. Naya repository banayein (jaise `dukaan-order-system`)
3. Apne computer mein terminal/command prompt khol kar, project folder ke andar yeh commands chalayein:
   ```
   git init
   git add .
   git commit -m "first version"
   git remote add origin <aapke_github_repo_ka_link>
   git push -u origin main
   ```
4. Jaayein **vercel.com**, GitHub se login karein
5. "Add New Project" pe click karein
6. Apna GitHub repo select karein
7. **Environment Variables** section mein yeh 2 add karein:
   - `VITE_SUPABASE_URL` = aapki Project URL
   - `VITE_SUPABASE_ANON_KEY` = aapki anon key
8. "Deploy" pe click karein — 1-2 minute mein live ho jaayega!

### Option B: Seedha Upload (Agar GitHub nahi use karna)

1. Apne computer mein, project folder ke andar terminal khol kar:
   ```
   npm install
   npm run build
   ```
2. Yeh ek `dist` folder banayega
3. **vercel.com** pe jaakar, "Add New Project" → "Deploy without Git"
4. `dist` folder ko drag-drop karein
5. Deploy ho jaayega

---

## STEP 6: Test Karein

1. Vercel aapko ek live link dega, jaise: `dukaan-order-system.vercel.app`
2. Yeh link khol kar dekhein — products dikhne chahiye
3. Ek test order place karein customer side se
4. "Dukaandar Panel" pe switch karke check karein ki order dikh raha hai ya nahi

---

## Aage Kya Karein

- **Apna domain** chahiye (jaise `sharmakirana.com`)? Vercel ke Settings mein "Domains" section se add kar sakte hain
- **Naye products add karne hain**? Abhi Supabase ke "Table Editor" se manually add kar sakte hain (Step 7 dekhein)
- **WhatsApp number badalna hai**? Supabase Table Editor mein `stores` table khol kar `whatsapp_number` column edit karein

---

## STEP 7 (Optional): Products Add/Edit Karna Supabase Se

1. Supabase project mein, left side **"Table Editor"** pe click karein
2. `products` table khol kar naya row add karein (naam, category, emoji)
3. Us product ka `id` copy karein
4. `variants` table mein jaakar naya row add karein — `product_id` mein wahi id paste karein, fir label/unit/price/stock bharein

Yeh thoda manual hai abhi — future mein hum isके liye ek **admin form** bhi bana sakte hain jisse aap seedha website se products add kar sakein, bina Supabase khole.

---

## Koi Problem Aaye?

Agar "Connect nahi ho paaya" jaisa error dikhe website pe:
- Check karein `.env` file mein keys sahi se paste hui hain (extra space na ho)
- Vercel pe deploy kiya hai, toh Environment Variables wahan bhi daalna na bhoolein
- Supabase project "paused" toh nahi hai (free tier 1 week inactivity pe pause ho sakta hai — Supabase dashboard se "Resume" kar dein)
