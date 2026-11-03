# Dukaan — Push notifications setup (one time)

1. **VAPID keys** (free, on your PC): `npx web-push generate-vapid-keys` — keep the Public and Private key. Use the same pair for Verilo too.
2. **Supabase → Database → Extensions**: make sure `pg_net` is enabled.
3. **Supabase → SQL Editor**: run `migrations/migration_web_push.sql`.
4. **Supabase → Edge Functions → New function `send-push`**: paste `edge-functions/send-push.ts`, **Verify JWT = OFF**, deploy.
5. **Edge Functions → Secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (= `mailto:` + your email), `PUSH_SECRET` (any long random text).
6. **SQL Editor** (once):
   `update push_config set function_url = 'https://<your-project>.supabase.co/functions/v1/send-push', secret = '<same PUSH_SECRET>' where id = 1;`
7. **Cloudflare Pages → Settings → Environment variables**: `VITE_VAPID_PUBLIC_KEY` = the Public key → redeploy.
8. Test: open the owner app → tap "Turn on order alerts" → place a test order from another phone → the owner phone gets "New order".

Without step 6 everything is a silent no-op (orders never break because of push).
