# Multi-Tenant Upgrade - Migration Guide

Yeh guide batati hai ki **purane single-store system** se **naye multi-tenant system**
(jahan koi bhi signup karke apni dukaan bana sake) mein kaise upgrade karein.

---

## Kya Badal Gaya Hai

| Pehle | Ab |
|---|---|
| 1 hi dukaan (`sharma-kirana`) hardcoded | Koi bhi signup karke apni dukaan bana sakta hai |
| Admin Panel PIN se locked | Real login (email + password) |
| Customer ko seedha homepage pe dukaan dikhti thi | Customer ko `yourapp.com/dukaan-ka-naam` link milega |
| Dukaandar ke liye alag link nahi tha | Dukaandar `yourapp.com` (homepage) pe login karke apna dashboard dekhega |

---

## STEP 1: Supabase Database Reset Karein

Important: Yeh purana test data delete karega.

1. Supabase SQL Editor kholen
2. Naye schema.sql (jo zip mein hai) ka poora content copy-paste karein
3. "Run" dabayein
4. "Success" dikhna chahiye - ab 4 tables (stores, products, variants, orders) naye sirre se ban gaye hain, user_id column ke saath

---

## STEP 2: Supabase Auth Settings Check Karein

1. Supabase dashboard mein, left sidebar "Authentication" pe jaayein
2. "Providers" mein "Email" already enabled hona chahiye (default hota hai)
3. "URL Configuration" mein jaayein:
   - Site URL: apni Vercel wali website ka link daalein (jaise https://dukaan-order-system-xxx.vercel.app)
   - Yeh zaroori hai taaki signup confirmation email sahi link bheje

### Email Confirmation Band Karna (Testing Ke Liye Easy)

Abhi testing ke liye, har signup pe email confirm karne ka jhanjhat na ho, iske liye:
1. Authentication -> Providers -> Email mein jaayein
2. "Confirm email" toggle ko OFF kar dein
3. Save karein

(Production mein jaane se pehle isे wapas ON kar sakte hain, taaki fake emails na ban sakein)

---

## STEP 3: Naya Code Deploy Karein

1. Naya zip extract karein
2. Apni .env file mein wahi purani Supabase URL/Key daal dein (yeh same rahegi)
3. Saare files apne GitHub repo mein replace karein
4. Terminal mein:
   ```
   git add .
   git commit -m "multi-tenant upgrade"
   git push
   ```
5. Vercel automatically naya version deploy kar dega

---

## STEP 4: Test Karein

1. Apni website ka homepage kholen (jaise dukaan-order-system-xxx.vercel.app)
2. "Naya Account" pe click karein
3. Email/password daal kar account banayein
4. Apni dukaan ka naam, link (slug), business type, WhatsApp number bharein
5. "Dukaan Banayein" dabayein
6. Ab aapka dashboard khulega - yahan se products add kar sakte hain (Admin tab se)
7. Apni dukaan ka customer link (jaise /sharma-kirana) copy karke naye tab mein khol kar test karein

---

## Customer Ko Kya Dena Hai

Bas itna: yourapp.vercel.app/unki-dukaan-ka-naam

Yeh link unke products dikhayega, order le sakega - koi login nahi chahiye customer ko.

## Dukaandar Khud Kya Karega

1. yourapp.vercel.app (sirf homepage) pe jaayein
2. Login karein
3. Apna dashboard + admin panel use karein - apna data hi dikhega, kisi aur ka nahi
