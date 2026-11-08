// supabase/functions/site-stats/index.ts
// The visitor tally — the whole counter behind the numbers under the clock.
//
//   public call  POST { path, lang, ref }   -> writes one hit, returns
//                { ok, views, visitors, today } for the homepage
//   admin call   POST { password, days? }   -> totals + the full breakdown:
//                day series, top pages, referrers, languages, devices, browsers
//
// Nothing leaves this project. There is no third-party endpoint in this
// path, no cookie and no fingerprint: a visitor is stored as
// sha256(salt | ip | baghdad-day), which (a) cannot be walked back to an
// address and (b) changes every day, so nobody can be followed from one
// day to the next.
//
// Deploy:  supabase functions deploy site-stats --no-verify-jwt
// Secrets: supabase secrets set STATS_SALT="$(openssl rand -hex 16)"
//          (ADMIN_PASSWORD is the secret list-requests already uses)
//
// Without STATS_SALT the function still serves the site, but it falls back
// to a salt that dies with the isolate: page views stay exact, daily
// uniques are counted per isolate, so the visitor number is conservative
// rather than spoofable.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

const LANGS = ["en", "ar", "ku", "tr", "fr", "es", "de", "ru", "zh", "ja", "ko", "hi"];

// a page view is a person in a browser. crawlers, scripts and uptime
// checks are not counted at all — an inflated counter is worse than a
// smaller one, because the number is the point of the whole exercise.
const BOT = /bot|crawl|spider|slurp|curl|wget|python|scrapy|http\.?client|headless|phantom|selenium|puppeteer|playwright|lighthouse|uptime|monitor|pingdom|feedly|w3c_|okhttp|java[\/ ]|go-http-client|node-fetch|deno\/|axios|winhttp|libwww|whatsapp|telegrambot|discordbot|slackbot|facebookexternalhit|twitterbot|linkedinbot/i;

function deviceOf(ua: string): string {
  if (/ipad|tablet|playbook|silk|android(?!.*mobile)/i.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod|windows phone|blackberry/i.test(ua)) return "mobile";
  if (/bot|curl|wget|python|spider/i.test(ua)) return "other";
  return "desktop";
}

function browserOf(ua: string): string {
  if (/edg[ei]?[oa]?[s]?\/|edge\//i.test(ua)) return "edge";
  if (/oppo|heytapbrowser/i.test(ua)) return "other";
  if (/samsungbrowser/i.test(ua)) return "samsung";
  if (/firefox|fxios/i.test(ua)) return "firefox";
  if (/chrome|crios/i.test(ua)) return "chrome";
  if (/safari/i.test(ua)) return "safari";
  return "other";
}

// the counter's day boundary is Baghdad's, because that is the clock the
// number sits under. en-CA gives the ISO YYYY-MM-DD the date column wants.
const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit",
});
function baghdadDay(d: Date): string {
  return DAY_FMT.format(d);
}

// a per-isolate salt is better than a guessable constant one
let fallbackSalt = "";
function randomSalt(): string {
  if (!fallbackSalt) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    fallbackSalt = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  return fallbackSalt;
}

async function visitorKey(ip: string, day: string): Promise<string> {
  const salt = Deno.env.get("STATS_SALT") || randomSalt();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + ip + "|" + day));
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < 16; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

// in-isolate flood guard: one isolate, one window, cheap. the map is
// swept on every call so a spoofed-ip flood cannot grow it without bound
const hits = new Map<string, number[]>();
const WINDOW_MS = 600_000;
const MAX_HITS = 120;      // 12 page views a minute is already more than a person does
const MAX_IPS = 5000;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > MAX_IPS) {
    for (const [k, v] of hits) if (v[v.length - 1] < now - WINDOW_MS) hits.delete(k);
    if (hits.size > MAX_IPS) hits.clear();
  }
  return list.length > MAX_HITS;
}

// hashing both sides first means the compare walks a fixed 32 bytes,
// so response timing carries no information about the password
async function sameSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const ba = new Uint8Array(ha);
  const bb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function cleanPath(v: unknown): string {
  let p = String(v ?? "/").split("?")[0].split("#")[0];
  if (p[0] !== "/") p = "/" + p;
  p = p.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  return p.slice(0, 200);
}

function cleanRef(v: unknown, self: string): string | null {
  const s = String(v ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!s || s.length > 80 || s === self || s.indexOf(".") < 0) return null;
  return /^[a-z0-9.\-:_]+$/.test(s) ? s : null;
}

function cleanLang(v: unknown): string {
  const l = String(v ?? "en").toLowerCase().slice(0, 5);
  return LANGS.indexOf(l) > -1 ? l : "en";
}

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// read the numbers without writing — what a bot or a flooded ip gets
async function readTotals(admin: ReturnType<typeof adminClient>, day: string) {
  const [t, d] = await Promise.all([
    admin.from("site_totals").select("views,visitors").eq("id", 1).maybeSingle(),
    admin.from("site_days").select("views,visitors").eq("day", day).maybeSingle(),
  ]);
  return {
    ok: true,
    counted: false,
    views: Number(t.data?.views ?? 0),
    visitors: Number(t.data?.visitors ?? 0),
    today: Number(d.data?.visitors ?? 0),
    todayViews: Number(d.data?.views ?? 0),
  };
}

async function record(admin: ReturnType<typeof adminClient>, day: string, key: string, f: {
  path: string; lang: string; ref: string | null; device: string; browser: string;
}) {
  const { data, error } = await admin.rpc("record_hit", {
    p_day: day, p_uniq: key, p_path: f.path, p_lang: f.lang,
    p_ref: f.ref, p_device: f.device, p_browser: f.browser,
  });
  if (error) throw error;
  const r = (data ?? {}) as Record<string, number>;
  return {
    ok: true,
    counted: true,
    views: Number(r.views ?? 0),
    visitors: Number(r.visitors ?? 0),
    today: Number(r.todayVisitors ?? 0),
    todayViews: Number(r.todayViews ?? 0),
  };
}

async function breakdown(admin: ReturnType<typeof adminClient>, body: any) {
  const want = Math.min(Math.max(parseInt(String(body.days ?? "30"), 10) || 30, 1), 365);
  const since = baghdadDay(new Date(Date.now() - (want - 1) * 86_400_000));

  const grouped = (col: string, extra?: (q: any) => any) => {
    const base = admin.from("site_hits")
      .select(`${col}, count()`)
      .gte("day", since)
      .group(col)
      .order("count", { ascending: false })
      .limit(12);
    return extra ? extra(base) : base;
  };

  const [totalsRow, series, paths, referrers, langs, devices, browsers, newest] = await Promise.all([
    admin.from("site_totals").select("views,visitors,updated_at").eq("id", 1).maybeSingle(),
    admin.from("site_days").select("day,views,visitors").gte("day", since).order("day", { ascending: false }).limit(want),
    grouped("path"),
    grouped("ref_domain", (q) => q.not("ref_domain", "is", null)),
    grouped("lang"),
    grouped("device"),
    grouped("browser"),
    admin.from("site_visitors").select("first_day").order("first_day", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    ok: true,
    role: "breakdown",
    since,
    days: want,
    totals: totalsRow.data ?? { views: 0, visitors: 0 },
    lastSeen: newest.data?.first_day ?? null,
    series: series.data ?? [],
    paths: paths.data ?? [],
    referrers: referrers.data ?? [],
    langs: langs.data ?? [],
    devices: devices.data ?? [],
    browsers: browsers.data ?? [],
    errors: [totalsRow, series, paths, referrers, langs, devices, browsers, newest]
      .map((r) => r.error?.message).filter(Boolean),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return json({ error: "body" }, 400);
  }
  if (raw.length > 4000) return json({ error: "too_large" }, 413);

  let body: any = {};
  try { body = JSON.parse(raw || "{}"); } catch { return json({ error: "body" }, 400); }

  const admin = adminClient();
  const day = baghdadDay(new Date());

  // the desk asks for the breakdown with the same password the inbox uses
  const password = String(body.password ?? "");
  if (password) {
    const expected = Deno.env.get("ADMIN_PASSWORD");
    if (!expected || !(await sameSecret(password, expected))) {
      return json({ error: "unauthorized" }, 401);
    }
    try {
      return json(await breakdown(admin, body));
    } catch {
      return json({ error: "server" }, 500);
    }
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "";

  try {
    // a crawler or a flood is answered with the real numbers but writes
    // nothing, so neither of them can move the counter
    if (BOT.test(ua) || !ua || tooMany(ip)) return json(await readTotals(admin, day));

    const host = (req.headers.get("origin") ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "");
    const key = await visitorKey(ip, day);
    return json(await record(admin, day, key, {
      path: cleanPath(body.path),
      lang: cleanLang(body.lang),
      ref: cleanRef(body.ref, host),
      device: deviceOf(ua),
      browser: browserOf(ua),
    }));
  } catch {
    return json({ error: "server" }, 500);
  }
});
