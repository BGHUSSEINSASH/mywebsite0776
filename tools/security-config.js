/* one place that decides what the site allows. firebase.json, the
   content-security-policy meta tag on every page and tools/serve.js all
   read from here, so a header can never drift away from the tag a
   browser also enforces — when both are present the stricter reading
   wins, and drift shows up as a broken page, not a hole.        */

const DIRECTIVES = [
  "default-src 'self'",
  // no 'unsafe-inline': every script on the site is a file now
  "script-src 'self' https://cdnjs.cloudflare.com https://challenges.cloudflare.com",
  // gsap writes inline style attributes, so styles keep 'unsafe-inline'
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data:",
  "connect-src 'self' https://api.github.com https://*.supabase.co https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' mailto: https://wa.me",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests'
];

const CSP = DIRECTIVES.join('; ');

/* a <meta> cannot carry frame-ancestors: the browser drops the directive
   and prints an error on every page load. it belongs in the header, which
   is where firebase sends it — so the tag ships the rest and the console
   stays clean. */
const CSP_META = DIRECTIVES.filter((d) => !/^frame-ancestors/.test(d)).join('; ');

const HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), serial=(), hid=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

// the admin desk leaks nothing, not even a referrer
const ADMIN_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY'
};

// where each header set applies, in the shape firebase.json wants
const RULES = [
  { source: '**', headers: HEADERS },
  { source: '/admin', headers: ADMIN_HEADERS },
  { source: '/admin.html', headers: ADMIN_HEADERS }
];

module.exports = { CSP, CSP_META, HEADERS, ADMIN_HEADERS, RULES };
