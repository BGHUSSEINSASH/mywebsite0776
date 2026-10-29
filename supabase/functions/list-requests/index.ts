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
const tries = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (tries.get(ip) ?? []).filter((t) => now - t < 600_000);
  list.push(now);
  tries.set(ip, list);
  return list.length > 10;
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
  try { password = String((await req.json()).password ?? ""); } catch { /* noop */ }

  const expected = Deno.env.get("ADMIN_PASSWORD");
  if (!expected || password !== expected) {
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
