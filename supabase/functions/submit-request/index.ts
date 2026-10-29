// supabase/functions/submit-request/index.ts
// Edge function: validates the turnstile token, rate-limits by ip,
// inserts the row with the service key and emails a notification.
// Deploy:  supabase functions deploy submit-request
// Secrets: supabase secrets set TURNSTILE_SECRET=... RESEND_API_KEY=... NOTIFY_EMAIL=...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICES = new Set([
  "website", "platform", "app", "server", "social", "design", "domain", "custom", "other",
]);
const BUDGETS = new Set(["b1", "b2", "b3", "b4"]);

function hashIp(ip: string): string {
  // salt comes from the function env; the raw ip is never stored
  const salt = Deno.env.get("IP_SALT") ?? "sash-salt";
  let h = 0;
  const str = salt + ip;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return "h" + (h >>> 0).toString(36);
}

async function turnstileOk(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) return true;            // not configured yet: skip (honeypot + rate limit still apply)
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
  });
  const json = await res.json();
  return json.success === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method" }), { status: 405, headers: cors });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = hashIp(ip);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // rate limit: 5 per hour per ip
    const { data: recent, error: rlErr } = await admin
      .from("rate_log")
      .select("id", { count: "exact", head: false })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if (rlErr) throw rlErr;
    if ((recent?.length ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: cors });
    }

    const body = await req.json();
    const service = String(body.service ?? "other");
    const email = String(body.email ?? "").trim();
    const name = String(body.name ?? "").trim();
    const details = String(body.details ?? "").slice(0, 4000);
    const phone = String(body.phone ?? "").slice(0, 40).trim();
    const lang = String(body.lang ?? "en").slice(0, 5);
    const budget = BUDGETS.has(body.budget) ? body.budget : null;
    const turnstile = String(body.turnstile ?? "");

    if (!SERVICES.has(service)) {
      return new Response(JSON.stringify({ error: "service" }), { status: 400, headers: cors });
    }
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      return new Response(JSON.stringify({ error: "invalid" }), { status: 400, headers: cors });
    }
    if (await turnstileOk(turnstile, ip) === false) {
      return new Response(JSON.stringify({ error: "captcha" }), { status: 403, headers: cors });
    }

    const { error: insErr } = await admin.from("service_requests").insert({
      lang, service, budget, details, name, email, phone, ip_hash: ipHash,
    });
    if (insErr) throw insErr;

    await admin.from("rate_log").insert({ ip_hash: ipHash });

    // fire-and-forget email notification
    const notify = Deno.env.get("NOTIFY_EMAIL");
    const resend = Deno.env.get("RESEND_API_KEY");
    if (notify && resend) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + resend, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "portfolio@resend.dev",
          to: notify,
          subject: "New build request — " + service + " — " + name,
          text:
            "Service: " + service + "\nBudget: " + (budget ?? "-") + "\n" +
            "Name: " + name + "\nEmail: " + email + "\nPhone: " + (phone || "-") + "\nLang: " + lang + "\n\n" +
            details,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: "server" }), { status: 500, headers: cors });
  }
});
