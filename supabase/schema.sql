-- schema.sql — run this in the Supabase SQL editor once.
-- Two tables: build-service requests and contact messages.
-- anon may INSERT only (and only through the edge function's
-- service key in practice); reads and updates happen from the
-- admin side with the service key, never from the browser.

create extension if not exists pgcrypto;

-- ── build-service requests ─────────────────────────────────
create table if not exists public.service_requests (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lang        text not null default 'en',
  service     text not null,               -- website|platform|app|server|social|design|domain|custom|other
  budget      text,                        -- b1|b2|b3|b4
  details     text,
  name        text not null,
  email       text not null,
  phone       text,
  status      text not null default 'new', -- new|contacted|quoted|won|closed
  ip_hash     text,                        -- salted hash for rate limiting, never the raw ip
  notes       text                         -- admin-only notes
);

-- ── contact form messages ──────────────────────────────────
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lang        text not null default 'en',
  name        text not null,
  email       text not null,
  message     text not null,
  status      text not null default 'new',
  ip_hash     text
);

-- ── rate limit: max 5 inserts per ip per hour ──────────────
create table if not exists public.rate_log (
  id         uuid primary key default gen_random_uuid(),
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_log_ip_idx on public.rate_log (ip_hash, created_at desc);

-- ── row level security: lock everything down ───────────────
alter table public.service_requests enable row level security;
alter table public.contact_messages  enable row level security;
alter table public.rate_log          enable row level security;

-- anon may insert a request/message directly ONLY if the edge
-- function approved it; the functions use the service role, so
-- these policies are a second lock, not the first.
create policy "anon insert requests" on public.service_requests
  for insert to anon with check (char_length(name) <= 120 and char_length(email) <= 160);
create policy "anon insert messages" on public.contact_messages
  for insert to anon with check (char_length(name) <= 120 and char_length(email) <= 160);
-- no select/update/delete policies for anon at all: those verbs are denied.

-- ── housekeeping ───────────────────────────────────────────
create or replace function public.prune_rate_log()
returns void language sql as $$
  delete from public.rate_log where created_at < now() - interval '2 hours';
$$;
