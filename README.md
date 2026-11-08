# BG Hussein Sash — Portfolio

(current asset token: `r24` — see the cache-busting ritual below)

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
3. Deploy the three edge functions:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy submit-request
   supabase functions deploy list-requests
   supabase functions deploy site-stats --no-verify-jwt   # the visitor counter
   ```
4. Secrets:
   ```bash
   supabase secrets set ADMIN_PASSWORD="$(openssl rand -hex 24)"
   supabase secrets set TURNSTILE_SECRET=...      # from dash.cloudflare.com → Turnstile
   supabase secrets set RESEND_API_KEY=...        # from resend.com (free tier)
   supabase secrets set NOTIFY_EMAIL=sash0750605070607@gmail.com
   supabase secrets set IP_SALT="$(openssl rand -hex 16)"
   supabase secrets set STATS_SALT="$(openssl rand -hex 16)"   # visitor-key salt
   ```
5. Point the frontend at it — in `assets/js/tally.js` (the script every public page
   loads first, so it is the one place the url lives):
   - `SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'`
   `main.js` reads that back for the order form; filling it in `main.js` instead
   works too and wins when both are set.
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
node tools/build-cases.js      # regenerate work/*.html + sitemap.xml
node tools/serve.js &          # then:
node tools/verify-shell.js     # the PWA shell has no 404, and every page's
                               # og:image is that page's own artwork
```

## i18n pipeline

- Source of truth: `assets/i18n/translations.json` — 12 languages, 441 keys
- `node tools/build-cases.js` rebuilds the 6 case pages from it, with the same
  CSP meta and the same `theme.js` boot the hand-written pages use. It also
  rewrites `sitemap.xml`, whose `<lastmod>` is the newest mtime among the page,
  the translations and the scripts that render it — a page is only rewritten
  when its bytes change, so the date moves when content moves, not when the
  tool happens to run.
- Language URLs: `?lang=xx` is a real variant (the page renders in that
  language), and `main.js`/`case.js` rewrite `canonical` + `og:url` to the
  self URL when the parameter is present. Google only trusts an hreflang
  cluster whose targets are their own canonical, so that rewrite is what makes
  the twelve `<link rel="alternate">` tags on each page mean anything —
  deleting it silently turns them back into decoration. `robots.txt` keeps
  `/admin` out of the crawl; the desk also answers with `X-Robots-Tag`.
- Two of the six projects (Ziona Passports, Hala Sat) have no product artwork,
  so they ship a typographic cover named after their slug. `alt.shot` says
  "live site screenshot" and `alt.cover` says it is a cover; the generator
  picks per project, and a case page must never borrow another project's file.
- Cache-busting ritual: `assets/**` is served `immutable`, so an asset change
  only reaches a returning visitor when the token moves. Bump `?v=rNN` in
  every page **and** `bgsash-vNN` in `service-worker.js` in the same commit —
  the two must never disagree. `node tools/check-security.js` says so.

## The visitor counter

No analytics provider is in this path and none will be: a counter that
reports your visitors to somebody else's server is not your counter.

- **What runs** — `assets/js/tally.js` is loaded by `index.html`, `404.html` and every
  `work/*.html`, before `main.js`. It posts one JSON body (`path`, `lang`, referrer
  *host*) to `supabase/functions/site-stats`, which writes the visit and returns the
  numbers. Nothing else: no cookie, no localStorage, no fingerprint, no script tag
  from a third domain, so the CSP never had to change (`connect-src` already allows
  `https://*.supabase.co`).
- **What is stored** — `site_hits` (one row per page view), `site_visitors` (one row
  per visitor-day), `site_days` and `site_totals` (the aggregates). The homepage reads
  `site_totals` and `site_days` through the function, which is why the tally is two
  indexed rows and not a scan, and why `assets/**` stays `immutable` — the numbers are
  never in a cached file.
- **Who is a visitor** — `sha256(STATS_SALT | ip | baghdad-day)`, 32 hex chars. The raw
  ip is never written, and because the day is in the hash the key is different
  tomorrow, so a person cannot be followed across days. `visitors` on the page is
  therefore unique-visitor-days summed: the honest unit when there is no cookie.
- **What is not counted** — crawlers, scripts, headless checks, uptime pings and an
  ip that posts more than 120 times in 10 minutes. Those calls get the real numbers
  and write nothing, so a flood cannot inflate the tally.
- **R.L.S.** — all four tables have row level security on and **no policies**, so
  `anon` cannot select, insert, update or delete a single row, and `record_hit` is
  revoked from `anon`. Every write goes through the edge function with the service key.
- **The full breakdown** — open `/admin` and the Visits desk asks the same function
  with the same password: totals, a day-by-day series with a shape bar, top pages,
  outside referrers, languages, devices and browsers, for 7/30/90/180/365 days.
  `site_hits` ages out after 180 days (`prune_site_hits()`); the day rows and the
  totals stay, so the numbers never shrink.

Set `STATS_SALT` or the function falls back to a per-isolate salt: page views stay
exact, daily uniques are counted per isolate — conservative, never spoofable. Leave
`SUPABASE_URL` empty and the box under the clock stays hidden. The site never prints
a number nobody counted.
