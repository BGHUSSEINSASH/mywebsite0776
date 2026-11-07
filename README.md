# BG Hussein Sash — Portfolio

(current asset token: `r22` — see the cache-busting ritual below)

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
6. Anti-spam (Turnstile): put the **site key** in `assets/js/main.js`
   (`TURNSTILE_SITEKEY = '0x4AAA...'`). The script then loads itself at step 3
   of the wizard, from `challenges.cloudflare.com` — the host the CSP already
   allows. Leave it empty and no third-party captcha is fetched at all.
   The widget div in `index.html` (`#oTurnstile`) stays as it is — the key
   belongs in the JS, so there is one place to change and nothing to forget.
7. Admin dashboard: set `ENDPOINT` in `assets/js/admin.js` to
   `https://YOUR-PROJECT.supabase.co/functions/v1/list-requests`, then open
   `/admin`. The password is typed per tab and never written to storage.

## Protection layers

One config drives them all — `tools/security-config.js` holds the CSP string,
the response headers and the per-path rules. `node tools/apply-security.js`
copies them into `firebase.json` and the three `<meta>` tags, and
`node tools/check-security.js` fails when anything drifts.

- **CSP**: no `unsafe-inline` in `script-src` (there is no inline script left
  on any page), no `unsafe-eval`, `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self' mailto: https://wa.me`.
- **Headers**: HSTS with preload, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` (`no-referrer` on the
  admin), tight `Permissions-Policy`, COOP and CORP `same-origin`.
- **Third-party code**: cdnjs GSAP loads with `sha512` SRI + `crossorigin` +
  `no-referrer`; fonts come from the two Google hosts, nothing else.
- **Forms**: honeypot on both (client ignores it, `submit-request` answers
  `200 ok` and drops the row), Turnstile when a key is set, a 20 s client
  cooldown, 5 requests/h per hashed IP and a 20 KB body cap on the function.
- **Admin**: password compare is hashed on both sides (no timing leak), 10
  tries/10 min per IP, rows are built with `textContent` (no `innerHTML`),
  the token dies with the tab, `Ctrl+Shift+L` locks it, and the service
  worker never caches `/admin`.
- **Copy/scraper guards**: `user-select:none`, contextmenu/copy/cut/drag and
  the devtools shortcuts, frame breakout. Honest limit: HTML that renders in
  a browser can be read by anything that renders it — these layers stop
  casual copying and most bots, not a determined person.
- **Not published**: Firebase uploads what is in this folder and nothing
  else; `tools/serve.js` 404s `/tools/`, `/supabase/` and `/.git*` so local
  behaviour matches production. `assets/cv/` **is** published — the CV
  downloads are public documents on purpose; `check-security.js` fails if a
  cv link stops resolving or leaves the offline shell.

Verify before every deploy:

```bash
node tools/apply-security.js   # headers + meta from one config
node tools/check-security.js   # the security gate
node tools/check-i18n.js       # the language gate
node tools/build-cases.js      # regenerate work/*.html
node tools/serve.js &          # then:
node tools/verify-shell.js     # the PWA shell has no 404
```

## i18n pipeline

- Source of truth: `assets/i18n/translations.json` — 12 languages, 427 keys
- `node tools/build-cases.js` rebuilds the 6 case pages from it, with the same
  CSP meta and the same `theme.js` boot the hand-written pages use.
- Cache-busting ritual: `assets/**` is served `immutable`, so an asset change
  only reaches a returning visitor when the token moves. Bump `?v=rNN` in
  every page **and** `bgsash-vNN` in `service-worker.js` in the same commit —
  the two must never disagree. `node tools/check-security.js` says so.

## Analytics

Umami hooks are wired but inert — fill `UMAMI_SRC`/`UMAMI_ID` in `assets/js/main.js`.
An analytics host is a third-party script: adding one means adding it to
`tools/security-config.js` (`script-src` **and** `connect-src`), then re-running
`apply-security.js`. Until you do, CSP blocks it — which is the point.
