# BG Hussein Sash — Portfolio

(current asset token: `r27` — see the cache-busting ritual below)

Studio spec-sheet portfolio for Hussein Majed Aidan (BG Hussein Sash) — IT Manager & Software Engineer, Baghdad.

**12 languages** (en, ar, ku, tr, fr, es, de, ru, zh, ja, ko, hi) · real screenshots · case-study pages · pricing + 3-step order wizard · PostgreSQL (Supabase) backend · PWA · layered protection · Lighthouse 100/100/100.

## Deploy

```bash
npx firebase-tools login
npx firebase-tools deploy --only hosting
```

## Deploy — any Apache host (InfinityFree, cPanel, a VPS)

Firebase reads `firebase.json`; Apache reads `.htaccess`. Both are rendered
from `tools/security-config.js`, so there is one policy with two spellings of
it, and `tools/check-security.js` regenerates `.htaccess` and compares it byte
for byte — changing the policy without regenerating fails the build.

```bash
node tools/make-package.js --zip                      # dist/infinityfree + dist/infinityfree.zip
node tools/verify-apache.js https://your-host.example  # 103 assertions against the live host
```

The package is the same file set Firebase publishes, because
`tools/make-package.js` reads the `ignore` list out of `firebase.json` rather
than keeping a second list that can drift. Upload the zip through the host's
file manager into `htdocs/` and extract it there, or push the folder over FTP.

Two things about the archive are deliberate:

- The zip is written by `tools/zip.js`, not by `Compress-Archive`. The Windows
  cmdlet names its entries with backslashes, and a Linux extractor obeys the
  bytes it is given — so it creates one file literally named
  `.well-known\security.txt` instead of a folder and a file. `.htaccess` and
  `security.txt` silently never arrive, and the host still reports success.
  The writer reads its own central directory back and refuses to ship a
  backslash.
- Nothing in the package assumes a module is loaded. Every module-dependent
  block sits inside `<IfModule>`, because a `.htaccess` line Apache cannot
  resolve is a 500 on *every* page, not a warning.

What each module is worth, measured on Apache 2.4.69:

| the host has | what you get |
|---|---|
| `mod_rewrite` + `mod_headers` | everything: clean urls, all eight headers verbatim, the admin override, the three cache tiers |
| `mod_rewrite` only | the site is whole and the CSP `<meta>` tag on every page holds the policy. Lost: `frame-ancestors` and HSTS, which a meta tag cannot carry |
| neither | the home page and every asset load, and every internal link is a 404 — not one page on this site links to a `.html` file |

So `mod_rewrite` is the one hard requirement, and InfinityFree documents it as
enabled. `tools/verify-apache.js` distinguishes these cases instead of
reporting a wall of red: a missing header is named as the downgrade it is.

The https redirect is deliberately not in the committed `.htaccess` — forcing
https before the certificate exists on the account turns a working site into an
unreachable one. Once SSL is on, `node tools/make-htaccess.js --host
your.domain` writes a redirect pinned to that single hostname.

**Two origins, one site.** The canonical tag, `og:url` and `sitemap.xml` all
name `https://mywebsite0776.web.app/`. Publishing the same pages on a second
host costs a reader nothing and the canonical tells a search engine which copy
is the real one — but it also means the second host collects no ranking of its
own. The generated layer takes its origin from one constant (`SITE` in
`tools/build-cases.js`), so moving it is one line plus
`node tools/build-cases.js`; `index.html`, `privacy.html`, `terms.html` and
`404.html` carry their own copies and are edited by hand.

## Optional: turn on the database (5 minutes)

The order wizard and contact form work without any backend (they fall back
to mail/WhatsApp). To save every request in PostgreSQL:

1. Create a free project at https://supabase.com
2. SQL Editor → paste `supabase/schema.sql` → run
3. Deploy the four edge functions:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy submit-request  --no-verify-jwt
   supabase functions deploy list-requests   --no-verify-jwt
   supabase functions deploy update-request  --no-verify-jwt
   supabase functions deploy site-stats      --no-verify-jwt
   ```
   All four need `--no-verify-jwt`, and this is easy to get wrong: none of
   them is called with a Supabase session, so with jwt verification on the
   gateway answers `401 Invalid API key` before the function ever runs —
   the forms look like they work (they fall back to mail) while the desk
   silently never opens.
4. Secrets:
   ```bash
   supabase secrets set ADMIN_PASSWORD="$(openssl rand -hex 24)"
   supabase secrets set TURNSTILE_SECRET=...      # from dash.cloudflare.com → Turnstile
   supabase secrets set RESEND_API_KEY=...        # from resend.com (free tier)
   supabase secrets set NOTIFY_EMAIL=sash0750605070607@gmail.com
   supabase secrets set IP_SALT="$(openssl rand -hex 16)"
   supabase secrets set STATS_SALT="$(openssl rand -hex 16)"   # visitor-key salt
   supabase secrets set MAIL_FROM="BG Sash <requests@YOUR-DOMAIN>"
   ```
   `MAIL_FROM` is optional. Unset, the notification leaves
   `portfolio@resend.dev` — Resend's sandbox sender, which only delivers to
   addresses Resend has verified for the account and puts a
   "please verify your domain" banner in the mail. Verify the domain at
   resend.com (it asks for a few DNS records), set `MAIL_FROM` to a real
   address on it, redeploy the function, and the requests arrive as mail
   from his own name. Replies go to the visitor who sent the request.
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
   `/admin`. The other three urls are derived from that one line
   (`site-stats` for the visits, `update-request` for the writes), so there
   is still exactly one place to configure. The password is typed per tab,
   never written to storage, and Lock wipes the rows out of the document.

## The admin desk

`/admin` is not an inbox any more — it reads, sorts and writes.

- **Requests**: the status pill is a dropdown (`new → contacted → quoted →
  won → closed`) and the Notes column is a private textarea. Both save on
  their own: change or blur posts `{ password, id, status | notes }` to
  `update-request`, which answers 400 for anything outside its whitelists,
  so a tampered body cannot name a column or a table. `Ctrl+Enter` commits a
  note from the keyboard.
- **Came from**: every request carries `utm_source / utm_medium /
  utm_campaign` off the address the visitor arrived with, plus the host that
  sent him. Nothing else is taken — no path, no query string, no cookie, no
  fingerprint. `submit-request` strips control characters and angle brackets
  and clips each value before storing it.
- **Availability**: the pill in the hero follows the Baghdad clock until he
  sets it to `open` or `closed` (with an optional note of his own words,
  120 characters). The state travels back on the counter's existing request,
  so this costs no extra call, and `auto` restores the clock exactly as it
  was.
- **CSV**: one button per table, built in the tab from the rows already
  loaded. A cell that starts with `=`, `@` or a tab gets a leading apostrophe
  because a spreadsheet would otherwise run it — and this text is typed by
  strangers. A `+964…` phone number is not a formula, so it stays as written.

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
  `no-referrer`. The fonts are served from this origin (`## The fonts`), so
  no visitor ip or user-agent ever reaches Google for a glyph.
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
node tools/split-i18n.js       # translations.json -> one file per language
node tools/check-security.js   # the security gate
node tools/check-i18n.js       # the language gate
node tools/build-cases.js      # regenerate work/*.html, sitemap.xml, the
                               # feeds, llms*.txt and api/profile.json
node tools/serve.js &          # then:
node tools/verify-shell.js     # the PWA shell has no 404, and every page's
                               # og:image is that page's own artwork
```

`.github/workflows/checks.yml` runs that list on every push to `main`, every
pull request, and on demand — plus `node --check` on each shipped script, a
`git diff --exit-code` right after `apply-security.js` (so a CSP meta edited
by hand instead of in `tools/security-config.js` fails the build), and
`tsc --noEmit` over the four edge functions against `tools/deno-shim.d.ts`,
which declares only what supabase's isolate provides. The workflow checks and
never deploys: publishing stays a decision, not something a push triggers.

## i18n pipeline

- Source of truth: `assets/i18n/translations.json` — 12 languages, 492 keys
- A new block of copy is written with the other eleven languages at the same
  time, never translated later: `tools/add-legal-i18n.js`,
  `tools/add-faq-i18n.js`, `tools/add-case-figures.js`,
  `tools/add-update-i18n.js` and `tools/add-shortcut-i18n.js` each hold their
  namespace as 12-wide arrays and merge them into the tree that `dig()` reads.
  Running one twice is harmless — an existing non-empty value is never overwritten.
- `node tools/split-i18n.js` then writes `assets/i18n/<code>.json` — one file
  per language, the same branch of the tree. Pages fetch their own language
  plus english (`say()` ends at english for any key a language does not carry),
  instead of downloading all twelve on every visit. `translations.json` stays
  the authored source and is never fetched: `check-i18n.js` fails if a split
  file stops matching its branch, or if a page or a shipped script asks the
  browser for the whole dictionary again. The same gate runs in CI
  (`split-i18n.js` + `git diff --exit-code -- assets/i18n`).
- **Edit translations, then re-split, then check.** A key added only to
  `translations.json` reaches no visitor.
- `node tools/build-cases.js` rebuilds the 6 case pages from it, with the same
  CSP meta and the same `theme.js` boot the hand-written pages use. It also
  rewrites `sitemap.xml`, `feed.xml`, `atom.xml`, `llms.txt`, `llms-full.txt`
  and `api/profile.json` (see `## The machine-readable layer`). The
  `<lastmod>` and the feed dates are the newest mtime among the page,
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
  the two must never disagree. `node tools/check-security.js` says so. The
  token also lives inside `main.js`, `case.js` and `notfound.js`, in the url
  each uses to fetch its language file, and that check walks `assets/js/*.js`
  for it too: a half-moved token serves new html against an old dictionary,
  and nothing looks broken. The
  woff2 files are the one exception: each url carries the hash of its own
  bytes, so a re-downloaded face busts its own cache without waiting for a
  release.

## The fonts

`assets/css/fonts.css` + `assets/fonts/*.woff2` — the same six families
(Unbounded, Newsreader, IBM Plex Mono, Hanken Grotesk, Noto Sans Arabic,
Noto Naskh Arabic) that used to come from Google, now served from this
origin. A hosted `css2` request tells Google a visitor ip, a user-agent and
the exact page they are reading; a font request is the one third-party call
that a portfolio has no reason to make.

- Regenerate with `node tools/fetch-fonts.js` (add `--force` to re-download).
  It reads the family list from the `QUERY` constant, keeps the subsets the
  twelve languages actually render (latin, latin-ext, cyrillic, cyrillic-ext,
  arabic — no vietnamese/math/symbols), copies every `unicode-range` verbatim
  and prunes files that fell out of the list. Never hand-edit `fonts.css`.
- Subset splitting is why an English visitor never pays for the Arabic face:
  the browser only pulls the ranges the page's characters fall in. Measured
  on the homepage: 8 of 25 files.
- Every url carries `?v=<first 10 hex of that file's own sha256>` instead of
  the release token, because `assets/**` ships `immutable` for a year: a
  swapped font has to bust its own cache without waiting for a release.
  `check-security.js` recomputes each hash from disk, so a stale or
  hand-edited token fails the gate.
- `style-src` and `font-src` are `'self'`-only now; the CSP is regenerated by
  `node tools/apply-security.js` from `tools/security-config.js`.

## The legal pages

`privacy.html` and `terms.html` — `/privacy` and `/terms`, hand-written like
`404.html`, styled by `assets/css/legal.css` (which repeats the palette instead
of importing `style.css`, so a homepage edit can never restyle a policy).

- Every sentence is a key: `legal.p.*` and `legal.t.*`, authored in
  `node tools/add-legal-i18n.js` as 12-wide arrays. Nothing is English-only,
  and `check-i18n.js` fails the build if a language is missing one.
- They run `case.js`, the same boot the case pages use: language, direction,
  theme, and the `?lang=` canonical rewrite that makes their twelve hreflang
  alternates true. `data-page-title` on the `h1` is what puts the translated
  word in the tab.
- `assets/css/legal.css` deliberately re-enables text selection: the site hides
  its own copy from scraping, but a policy is a document people quote.
- Both pages are in the offline shell, in `sitemap.xml` (built by
  `build-cases.js`), and linked from every footer — including the generated
  case pages.
- `tools/pages.js` is now the single list of pages the gates walk. It used to be
  four copies (`check-security`, `check-i18n`, `verify-shell`, `apply-security`),
  and a page added to one copy stayed invisible to the other three.

## Reading conditions

Three browser settings ask for the page to be drawn differently, and all three
are answered without touching the design at rest:

- `prefers-reduced-motion`: GSAP is never loaded, the reveal animations are
  dropped and `main.js` stops moving anything (see the r23 work).
- `prefers-contrast: more`: `--muted` darkens toward the ink and `--line`
  thickens to .45 alpha, plus a 3px focus ring. Every rule sits inside the
  media query, so nobody else sees a different pixel.
- `forced-colors: active` (Windows High Contrast, and the palette Edge/Chrome
  ≥122 hand you when it is on): the tokens are remapped to `Canvas`,
  `CanvasText` and `LinkText`, the experience dots get a real border instead
  of a shadow, and the custom cursor is removed — with it the page sets
  `cursor: none`, and a palette that paints over our CSS would leave the
  visitor with no pointer at all, so `cursor: auto` comes back with it.

They live in the last blocks of `assets/css/style.css` and
`assets/css/legal.css` — the two files that own a palette — plus the inline
`<style>` in `404.html`, which repeats the tokens instead of importing them.
Case pages and the spec sheet import `style.css`, so they inherit it. Nothing
here is decorative: a page that only reads as designed in one palette is a page
that only works for one kind of visitor.

## What the page does before you ask it to

Four things are lazy or opt-in because a portfolio is read, not driven:

- **A language, not the dictionary.** The first paint fetches `en.json` plus
  the visitor's own file; the other ten arrive when the `<select>` is used
  (`main.js`, `case.js`, `notfound.js` all work the same way).
- **The estimator.** `spec.js` builds the corner readout, the desk pill and
  the keyboard at load — it is all first screen — but the estimator chips,
  the currency list and the github block wait for `#est` to come within 400px
  (`armEst`/`ensureEst`), or for anything that names one of its inputs: the
  palette, the `estimate` terminal command, a print. The waiting is asked of
  `IntersectionObserver` and, in parallel, of a throttled scroll/resize read of
  `getBoundingClientRect` — the observer only reports while the browser paints,
  so a background tab or a crawler that never renders would otherwise never see
  the form. Building it changes the
  page height, so `SASH.refresh()` re-measures the pinned scroll animations.
- **A newer copy.** The service worker no longer `skipWaiting()`s over a
  reader: a first visit takes control at once, an update waits and `main.js`
  raises `.sw-update` (bottom corner, clear of the centred toast) asking to
  reload. Clicking it posts `sash:apply`, the worker calls `skipWaiting()`,
  `clients.claim()` fires `controllerchange` and the page reloads. Nothing
  swaps underneath anybody, and the cache the page on screen is reading from
  is not deleted while it still needs it. `check-security.js` keeps the two
  halves of the handshake naming each other — the page posts exactly the
  string the worker listens for, the install step may only take over when
  there is nothing to interrupt, and the page may only reload after a click.
- **`?`.** The shortcut list is built by `spec.js` out of keys that already
  work, in words the site already translates (`hud.palette`, `hud.term`,
  `pal.esc`) plus `keys.*` from `tools/add-shortcut-i18n.js`. Print is not in
  it: `Ctrl+P` belongs to the browser and the anti-save guard answers it, so
  the spec sheet prints from its own button. Escape closes the topmost layer —
  shortcuts, then palette, then terminal — and a language change rebuilds the
  list rather than leaving it in the old language.

On the other side of the desk, `assets/js/admin.js` puts the count of
requests still in `new` on the tab itself: an svg icon with a red badge,
written as a data url (`img-src` allows `data:`), plus `(3) ` in the title for
the browsers that ignore svg favicons. Locking the desk takes the badge off.

## The machine-readable layer

What a crawler, a feed reader or a language model gets when it does not run
javascript. All of it is generated except one file, so none of it can fall
behind the pages it describes.

- `feed.xml` (RSS 2.0) and `atom.xml` carry the six case studies, with the
  problem/solution/result text inline, the role and the three chips as
  categories, and the case page url as the guid. Generated by `build-cases.js`
  from the same `PROJECTS` list, so a new case appears in both on the next run
  and a deleted one cannot leave a dangling entry behind.
- The date an item carries is the date **its page last changed**, not a claim
  about when the work was done: `projects.n.when` is a display string and two
  of them read "Field work", which is not a date and must never become a
  `pubDate`. Same source as the sitemap's `<lastmod>` — `stampOf()`.
- `llms.txt` is the index (one link per thing worth reading), `llms-full.txt`
  is the site as one text file for a model that reads once and does not fetch.
  Both are English on purpose: twelve files invite a model to answer in the
  wrong language, and the English branch is what every page ships baked in its
  markup. `robots.txt` points at both.
- `api/profile.json` is the same facts as data — identity, six services, six
  cases, eight price tiers, the ten questions, the five process stages, the
  twelve languages with their direction. The identity block is lifted out of
  the homepage `Person` JSON-LD and the contact hrefs are read out of the page
  that shows them, so this file cannot disagree about a phone number;
  `check-security.js` proves it does not. Prices stay USD, as on the estimator.
- `.well-known/security.txt` is the one hand-written file, because RFC 9116
  wants an `Expires:` and an expired contact address is worse than none:
  `check-security.js` fails the day it expires, which makes renewing it a
  yearly appointment instead of a surprise.
- Case pages say where a reader goes next twice: once to machines
  (`rel=prev`/`rel=next`, linear — the last case has no `next`, because a
  crawl loop is not what `rel=next` means) and once to people (the Next
  button, which wraps to the first case). Each one also `rel=prefetch`es the
  page that button points at, and advertises both feeds. `index.html`
  advertises the feeds and `rel=me` for GitHub.
- A case may show one figure — a fourth chip, in the shape the three chips
  already have — and only if `build-cases.js` can point at the sentence in the
  approved copy that states it: `FIGURES` at the top of that file lists the
  exact phrase, and the build stops when the phrase is not there. Today that
  is SmartMaid's 59 control switches and Bookly's four-step booking flow;
  Mukallaf and Flossk already carry theirs in a chip, and the two field cases
  state no count, so they show none. `node tools/add-case-figures.js` writes
  the strings in all twelve languages.
- Counts come from the data, not from a number typed into a template:
  `FAQ_N`, `PROC_N`, `PRICE_N`, `EXP_N` are counted out of `translations.json`,
  so a seventh question or a sixth tier appears in the feeds, both llms files
  and `profile.json` on the next run without editing four strings.
  `## How a job runs` and `## Small projects` (the tiers whose own price line
  reads `$150` or less — derived, so re-pricing moves the list) are generated
  the same way.
- Gates: `check-security.js` section 12 checks the item counts against the
  case pages on disk, that every url advertised by the layer has a file
  behind it, that a case page is not missing from the layer, that the xml has
  no unescaped `&`, that `profile.json` parses and its email is the one
  `index.html` shows, and that `robots.txt` still names the sitemap and the
  feed. `verify-shell.js` fetches all eight over http and checks the content
  type came back as xml/json/plain, not `text/html`. Section 13 counts the
  questions four different ways — the rows in the page, the `Question` entries
  in the `FAQPage` json-ld, the `faq.qN`/`aN` keys in each of the twelve
  languages, and the lists in both llms files and `profile.json` — because an
  entry added to one of them and not the others is a rich result the page
  promises without delivering, or a question that stays english forever.
- `404.html` and `admin.html` carry no `og:`/`twitter:` tags on purpose: both
  are `noindex`, and a share card for a page that must not be indexed is
  decoration for a crawler that is not supposed to read it.
- None of these files are in `firebase.json`'s `ignore`, so they publish with
  the site — but two of their paths are the kind a host has historically
  treated specially: a folder starting with a dot, and a `.json` under a
  folder. Locally `verify-shell.js` proves they answer; after the next deploy
  fetch `/.well-known/security.txt` and `/api/profile.json` on the live host
  once and confirm the same, because only the real host can prove the host.

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
- **The week in one letter** — `supabase/functions/weekly-digest` takes the same
  password, reads the last seven Baghdad days out of those same four tables plus
  `requests`, and posts the summary to `NOTIFY_EMAIL`. It is the desk's numbers in
  an email, not a second opinion: every figure is read back, and a query that
  fails says so in the letter instead of printing a quiet zero. One letter per day
  is enforced in the database — `claim_digest(day)` inserts into `digest_state`
  and the function composes nothing until it wins that insert, so a cron that
  fires twice sends once (`force` releases the claim for a deliberate resend).
  Nothing is scheduled from this repository: the cron line is in the function's
  own header comment, because the schedule is the one place the password would
  have to be written down, and that belongs in his project, not in git. With no
  `RESEND_API_KEY` it answers with the composed text instead of sending, so the
  summary is readable before the mail keys exist.

Set `STATS_SALT` or the function falls back to a per-isolate salt: page views stay
exact, daily uniques are counted per isolate — conservative, never spoofable. Leave
`SUPABASE_URL` empty and the box under the clock stays hidden. The site never prints
a number nobody counted.

**Seeing it before the project exists** — one exception to that last line, and it is
kept inside one machine. When the page is served by `node tools/serve.js` on a
loopback host (`localhost`, `127.0.0.1`, `[::1]`), `tally.js` posts to
`/functions/v1/site-stats` on its own origin, which the dev server answers from a
stand-in: same bot filter, same `sha256(salt|ip|baghdad-day)` uniqueness, same JSON
shape, counting into `$TMPDIR/bgsash-dev-tally.json`. So the box is visible and moves
while the four go-live steps are still undone. Nothing else changes: the test is keyed
to the loopback hostname, so a deployed page has no such endpoint to ask, and
`window.BGSASH_STATS.url` stays empty — the order form remains inert locally, exactly
as it would be on a real site without Supabase.
