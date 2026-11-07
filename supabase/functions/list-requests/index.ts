// supabase/functions/list-requests/index.ts
// Admin endpoint: POST { password } — returns requests + messages.
// The admin password lives only in edge-function secrets, never
// in the browser bundle. Deploy:
//   supabase functions deploy list-requests
//   supabase secrets set ADMIN_PASSWORD=... (long, random)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// simple fixed-window throttle: 10 tries / 10 min per ip
// the map is swept on every call so a spoofed-ip flood cannot grow it
// without bound — an isolate that runs out of memory stops serving,
// which is the very thing this check exists to prevent
const tries = new Map<string, number[]>();
const WINDOW_MS = 600_000;
const MAX_TRIES = 10;
const MAX_IPS = 5000;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (tries.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  tries.set(ip, list);
  if (tries.size > MAX_IPS) {
    for (const [k, v] of tries) if (v[v.length - 1] < now - WINDOW_MS) tries.delete(k);
    if (tries.size > MAX_IPS) tries.clear();   // every slot is hot: start over
  }
  return list.length > MAX_TRIES;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method" }), { status: 405, headers: cors });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooMany(ip)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: cors });
  }

  let password = "";
  try {
    const raw = await req.text();
    if (raw.length > 4000) throw new Error("body");
    password = String(JSON.parse(raw).password ?? "");
  } catch { /* noop */ }

  const expected = Deno.env.get("ADMIN_PASSWORD");
  if (!expected || !(await sameSecret(password, expected))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const [requests, messages] = await Promise.all([
    admin.from("service_requests").select("*").order("created_at", { ascending: false }).limit(200),
    admin.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  return new Response(JSON.stringify({
    requests: requests.data ?? [],
    messages: messages.data ?? [],
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
