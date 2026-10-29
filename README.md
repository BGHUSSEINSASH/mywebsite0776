# BG Hussein Sash — Portfolio (r09)

Studio spec-sheet portfolio for Hussein Majed Aidan (BG Hussein Sash) — IT Manager & Software Engineer, Baghdad.

**12 languages** (en, ar, ku, tr, fr, es, de, ru, zh, ja, ko, hi) · real screenshots · case-study pages · pricing + 3-step order wizard · PostgreSQL (Supabase) backend · PWA · layered protection · Lighthouse 100/100/100.

## Deploy

```bash
npx firebase-tools login
npx firebase-tools deploy --only hosting
```

## Optional: turn on the database (5 minutes)

The order wizard and contact form work without any backend (they fall back
to mail/WhatsApp). To save every request in PostgreSQL:

1. Create a free project at https://supabase.com
2. SQL Editor → paste `supabase/schema.sql` → run
3. Deploy the two edge functions:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy submit-request
   supabase functions deploy list-requests
   ```
4. Secrets:
   ```bash
   supabase secrets set ADMIN_PASSWORD="$(openssl rand -hex 24)"
   supabase secrets set TURNSTILE_SECRET=...      # from dash.cloudflare.com → Turnstile
   supabase secrets set RESEND_API_KEY=...        # from resend.com (free tier)
   supabase secrets set NOTIFY_EMAIL=sash0750605070607@gmail.com
   supabase secrets set IP_SALT="$(openssl rand -hex 16)"
   ```
5. Point the frontend at it — in `assets/js/main.js`:
   - `SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'`
6. Anti-spam (Turnstile): put your **site key** in `index.html`
   (`#oTurnstile` `data-sitekey`) and load their script where the CSP already
   allows `challenges.cloudflare.com`.
7. Admin dashboard: open `/admin.html` and set `ENDPOINT` inside it to
   `https://YOUR-PROJECT.supabase.co/functions/v1/list-requests`.

## i18n pipeline

- Source of truth: `assets/i18n/translations.json` (12 languages × 342 paths, 270 KB)
- Regenerate EN/AR + merge the 10 translated files:
  `node tools/build-cases.js` rebuilds the 6 case pages from it.
- Cache-busting: bump `?v=r09` in `index.html` and `work/*.html` when assets change.

## Protection layers

CSS `user-select:none` + JS guards (contextmenu/copy/cut/F12/Ctrl+U/P/S/A/J/I)
+ iframe breakout + CSP/SRI (`firebase.json` + meta) + Supabase RLS/turnstile/
rate-limiting on the forms. Honest note: anything served publicly can be
copy-minded-read; these layers stop casual copying and most scrapers.

## Analytics

Umami hooks are wired but inert — fill `UMAMI_SRC`/`UMAMI_ID` in `assets/js/main.js`.
