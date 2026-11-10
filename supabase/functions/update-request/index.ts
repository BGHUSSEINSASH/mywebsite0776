// supabase/functions/update-request/index.ts
// The write side of the admin desk. POST, password-gated, one body:
//
//   { password, id, status }              -> move one request along
//   { password, id, notes }               -> save the private note on it
//   { password, avail, availNote }        -> set the public availability pill
//
// There is no other way in: the browser holds no key, the tables have no
// anon policies, and every verb here is checked against a whitelist before
// it reaches postgres. The password is compared on hashes so the response
// time does not say how much of a wrong guess was right.
//
// Deploy:  supabase functions deploy update-request --no-verify-jwt
// Secrets: ADMIN_PASSWORD  (the same one list-requests uses)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

const STATUSES = ["new", "contacted", "quoted", "won", "closed"];
const AVAILS = ["auto", "open", "closed"];

// writes are throttled harder than reads: the desk only ever needs a few
// saves a minute, and a spoofed-ip flood must not turn into table churn
const tries = new Map<string, number[]>();
const WINDOW_MS = 600_000;
const MAX_WRITES = 60;
const MAX_IPS = 5000;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (tries.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  tries.set(ip, list);
  if (tries.size > MAX_IPS) {
    for (const [k, v] of tries) if (v[v.length - 1] < now - WINDOW_MS) tries.delete(k);
    if (tries.size > MAX_IPS) tries.clear();
  }
  return list.length > MAX_WRITES;
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

// a uuid from the browser is only ever allowed to be a uuid
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clip(v: unknown, max: number): string | null {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooMany(ip)) return json({ error: "rate_limited" }, 429);

  let body: any = {};
  try {
    const raw = await req.text();
    if (raw.length > 20000) return json({ error: "too_large" }, 413);
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ error: "body" }, 400);
  }

  const expected = Deno.env.get("ADMIN_PASSWORD");
  const password = String(body.password ?? "");
  if (!expected || !password || !(await sameSecret(password, expected))) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const out: Record<string, unknown> = { ok: true };
  const errors: string[] = [];

  // ── one request row: status and/or the private note ──────────
  if (body.id != null) {
    const id = String(body.id);
    if (!ID_RE.test(id)) return json({ error: "bad_id" }, 400);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status != null) {
      const s = String(body.status).toLowerCase();
      if (STATUSES.indexOf(s) < 0) return json({ error: "bad_status" }, 400);
      patch.status = s;
    }
    if (body.notes != null) patch.notes = clip(body.notes, 4000) ?? "";

    const { data, error } = await admin.from("service_requests")
      .update(patch)
      .eq("id", id)
      .select("id, status, notes, updated_at")
      .maybeSingle();
    if (error) errors.push(error.message);
    out.request = data ?? null;
    if (!data && !error) out.error = "no such row";
  }

  // ── the public availability pill ─────────────────────────────
  if (body.avail != null) {
    const s = String(body.avail).toLowerCase();
    if (AVAILS.indexOf(s) < 0) return json({ error: "bad_avail" }, 400);
    const { data, error } = await admin.from("avail_state")
      .upsert(
        { id: 1, state: s, note: clip(body.availNote, 120) ?? "", updated_at: new Date().toISOString() },
        { onConflict: "id" },
      )
      .select("state, note, updated_at")
      .single();
    if (error) errors.push(error.message);
    out.avail = data ?? null;
  }

  if (!body.id && body.avail == null) return json({ error: "nothing_to_do" }, 400);

  out.errors = errors;
  return errors.length ? json({ ...out, error: errors.join("; ") }, 500) : json(out);
});
