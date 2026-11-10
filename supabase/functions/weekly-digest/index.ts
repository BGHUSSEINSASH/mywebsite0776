// supabase/functions/weekly-digest/index.ts
// The week, in one letter.
//
//   POST { password, days?, force? }  -> reads the last `days` (7 by
//        default) Baghdad days out of the same four tables the counter
//        uses, composes a summary and posts it to NOTIFY_EMAIL.
//
// Nothing here is a new number. Every figure is read back from site_days,
// site_hits, site_totals and requests — the same rows the desk shows — so
// the letter and the table can never disagree. If a query fails, the letter
// says it failed instead of printing a quiet zero.
//
// One letter per day: the day is claimed in digest_state before anything is
// composed, so a cron that fires twice, and a manual retry on the same
// evening, both send one email and not three. force=true releases the claim
// for a deliberate resend.
//
// Deploy:  supabase functions deploy weekly-digest --no-verify-jwt
// Schedule (Supabase runs SQL, so pg_cron is the timer):
//   select cron.schedule('weekly-digest','0 20 * * 0',
//     $$select net.http_post(
//        url := 'https://PROJECT.functions.supabase.co/weekly-digest',
//        headers := '{"content-type":"application/json"}'::jsonb,
//        body := '{"password':'FROM_SUPABASE_SECRETS','days':7}'::jsonb)$$);
//          — the schedule line is the only place the password lives outside
//            the function, and it is in the project, not in this repository.
// Secrets: the ones the other functions already use — ADMIN_PASSWORD,
//          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and, for the letter
//          itself, RESEND_API_KEY / NOTIFY_EMAIL / MAIL_FROM.
//
// With no RESEND_API_KEY the function answers with the composed text
// instead of sending it, so the summary is readable through the desk on a
// project that has no mail keys yet. It never invents a recipient.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit",
});
function baghdadDay(d: Date): string {
  return DAY_FMT.format(d);
}

// the letter is written in english and sent to one address; a visitor's own
// words (paths, referrers) arrive inside it, so they are escaped on the way in
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function num(v: unknown): string {
  const n = Number(v ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US");
}

function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return Math.round((part / whole) * 100) + "%";
}

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

type Row = Record<string, string | number | null>;

function lines(rows: Row[], key: string, val: string, limit: number): { k: string; n: string; p: string }[] {
  const total = rows.reduce((a, r) => a + Number(r[val] ?? 0), 0);
  return rows.slice(0, limit).map((r) => ({
    k: String(r[key] ?? "-"),
    n: num(r[val]),
    p: pct(Number(r[val] ?? 0), total),
  }));
}

async function compose(admin: ReturnType<typeof createClient>, since: string, until: string, want: number) {
  const grouped = (col: string, extra?: (q: any) => any) => {
    const base = admin.from("site_hits")
      .select(`${col}, count()`)
      .gte("day", since)
      .lte("day", until)
      .group(col)
      .order("count", { ascending: false })
      .limit(10);
    return extra ? extra(base) : base;
  };

  const [days, paths, refs, langs, devices, requests, newestReq] = await Promise.all([
    admin.from("site_days").select("day,views,visitors").gte("day", since).lte("day", until).order("day", { ascending: true }),
    grouped("path"),
    grouped("ref_domain", (q) => q.not("ref_domain", "is", null)),
    grouped("lang"),
    grouped("device"),
    admin.from("requests").select("status, service").gte("created_at", since + "T00:00:00+03:00"),
    admin.from("requests").select("name").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const errors = [days, paths, refs, langs, devices, requests, newestReq]
    .map((r: any) => r.error?.message).filter(Boolean) as string[];

  const series = (days.data ?? []) as Row[];
  const views = series.reduce((a, r) => a + Number(r.views ?? 0), 0);
  const uniq = series.reduce((a, r) => a + Number(r.visitors ?? 0), 0);
  const best = series.reduce((a, r) => (Number(r.views ?? 0) > Number(a?.views ?? 0) ? r : a), series[0] ?? {} as Row);

  const reqs = (requests.data ?? []) as Row[];
  const byStatus: Record<string, number> = {};
  for (const r of reqs) {
    const s = String(r.status ?? "new");
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  return {
    since,
    until,
    days: series.length,
    window: want,
    views,
    visitors: uniq,
    bestDay: best.day ?? null,
    bestViews: Number(best.views ?? 0),
    topPages: lines((paths.data ?? []) as Row[], "path", "count", 5),
    referrers: lines((refs.data ?? []) as Row[], "ref_domain", "count", 5),
    langs: lines((langs.data ?? []) as Row[], "lang", "count", 6),
    devices: lines((devices.data ?? []) as Row[], "device", "count", 4),
    requests: {
      total: reqs.length,
      open: (byStatus["new"] ?? 0) + (byStatus["contacted"] ?? 0),
      done: (byStatus["won"] ?? 0) + (byStatus["lost"] ?? 0),
      last: newestReq.data?.name ?? null,
    },
    errors,
  };
}

function asText(s: Awaited<ReturnType<typeof compose>>): string {
  const block = (title: string, rows: { k: string; n: string; p: string }[]) =>
    rows.length ? title + "\n" + rows.map((r) => "  " + r.k + " — " + r.n + " (" + r.p + ")").join("\n") : "";
  const parts = [
    "BG Sash — week of " + s.since + " to " + s.until + " (Baghdad days)",
    "",
    "Views: " + num(s.views) + "   Visitors: " + num(s.visitors) + "   Days counted: " + s.days + "/" + s.window,
    s.bestDay ? "Busiest day: " + s.bestDay + " with " + num(s.bestViews) + " views" : "No page views inside this window",
    "",
    "Requests: " + s.requests.total + "  (open " + s.requests.open + ", closed " + s.requests.done + ")",
    s.requests.last ? "Most recent name: " + s.requests.last : "",
    "",
    block("Pages", s.topPages),
    block("Coming from", s.referrers),
    block("Languages", s.langs),
    block("Devices", s.devices),
    "",
    s.errors.length ? "Queries that failed: " + s.errors.join(" | ") : "Every query answered.",
  ];
  return parts.filter((x) => x !== "").join("\n");
}

function asHtml(s: Awaited<ReturnType<typeof compose>>): string {
  const table = (title: string, rows: { k: string; n: string; p: string }[]) => rows.length
    ? "<h2>" + esc(title) + "</h2><table>" +
      rows.map((r) => "<tr><td>" + esc(r.k) + "</td><td>" + esc(r.n) + "</td><td>" + esc(r.p) + "</td></tr>").join("") +
      "</table>"
    : "";
  return "<html><body style=\"font-family:system-ui;color:#16171a;max-width:640px\">" +
    "<h1>" + esc("Week of " + s.since + " to " + s.until) + "</h1>" +
    "<p>" + esc("Views") + ": <b>" + num(s.views) + "</b> · " +
    esc("Visitors") + ": <b>" + num(s.visitors) + "</b> · " +
    esc("Days counted") + ": " + s.days + "/" + s.window + "</p>" +
    "<p>" + esc(s.bestDay ? "Busiest day: " + s.bestDay + " (" + num(s.bestViews) + " views)" : "No page views inside this window") + "</p>" +
    "<p>" + esc("Requests") + ": <b>" + s.requests.total + "</b> · " +
    esc("open") + " " + s.requests.open + " · " + esc("closed") + " " + s.requests.done + "</p>" +
    table("Pages", s.topPages) +
    table("Coming from", s.referrers) +
    table("Languages", s.langs) +
    table("Devices", s.devices) +
    (s.errors.length ? "<p style=\"color:#a11\">" + esc("Queries that failed: " + s.errors.join(" | ")) + "</p>" : "") +
    "</body></html>";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let body: any = {};
  try {
    body = JSON.parse((await req.text()) || "{}");
  } catch {
    return json({ error: "body" }, 400);
  }

  const expected = Deno.env.get("ADMIN_PASSWORD");
  const password = String(body.password ?? "");
  if (!expected || !(await sameSecret(password, expected))) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const want = Math.min(Math.max(parseInt(String(body.days ?? "7"), 10) || 7, 1), 90);
  const until = baghdadDay(new Date());
  const since = baghdadDay(new Date(Date.now() - (want - 1) * 86_400_000));

  try {
    const { data: claim, error: claimErr } = await admin.rpc("claim_digest", { p_day: until });
    if (claimErr) return json({ error: "claim", detail: String(claimErr.message) }, 500);
    if (!claim && !body.force) return json({ ok: true, skipped: until, reason: "already sent today" });
    if (!claim && body.force) {
      await admin.from("digest_state").delete().eq("day", until);
      const again = await admin.rpc("claim_digest", { p_day: until });
      if (again.error) return json({ ok: true, sent: false, note: "forced, but the claim did not go back" });
    }

    const summary = await compose(admin, since, until, want);
    const subject = "BG Sash — " + summary.views.toLocaleString("en-US") + " views, " +
      summary.requests.total + " requests (" + since + " → " + until + ")";

    const notify = Deno.env.get("NOTIFY_EMAIL");
    const resend = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("MAIL_FROM") || "portfolio@resend.dev";
    if (!notify || !resend) {
      // no keys yet: hand the composed letter back to whoever asked, the
      // numbers are real and nothing was invented to fill the gap
      return json({ ok: true, sent: false, reason: "no mail keys", subject, text: asText(summary), summary });
    }

    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + resend, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: notify, subject, text: asText(summary), html: asHtml(summary) }),
    });
    if (!mail.ok) {
      // release the claim, so the next run can try again on the same day
      await admin.from("digest_state").delete().eq("day", until);
      return json({ error: "mail", status: mail.status }, 502);
    }
    return json({ ok: true, sent: true, to: notify, subject, summary });
  } catch (e) {
    return json({ error: "server", detail: String((e as Error)?.message ?? e) }, 500);
  }
});
