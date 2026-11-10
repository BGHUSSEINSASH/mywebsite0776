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

-- where the visitor came from, stored beside the request so the inbox can
-- answer "did the instagram link or the google search bring him" without
-- a second tracker anywhere on the site. the browser sends only the four
-- fields below, the utm ones read off the url and the referrer reduced to
-- its host — no path, no query, no cookie id.
alter table public.service_requests add column if not exists source     text;   -- utm_source
alter table public.service_requests add column if not exists medium     text;   -- utm_medium
alter table public.service_requests add column if not exists campaign   text;   -- utm_campaign
alter table public.service_requests add column if not exists referrer   text;   -- outside host only
alter table public.service_requests add column if not exists updated_at timestamptz not null default now();
create index if not exists service_requests_source_idx on public.service_requests (source, created_at desc);

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

-- ── availability, decided by him rather than by the clock ────
-- the pill in the hero normally reads the Baghdad working hours. a state
-- set here wins over the clock until it is put back to 'auto', so "fully
-- booked this month" can be said without touching the code. one row, and
-- the note is his own words (the function caps it at 120 characters).
create table if not exists public.avail_state (
  id         int primary key check (id = 1),
  state      text not null default 'auto',          -- auto|open|closed
  note       text,
  updated_at timestamptz not null default now()
);
insert into public.avail_state (id, state) values (1, 'auto') on conflict (id) do nothing;

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
-- the availability row is read and written only through the edge
-- functions with the service key; a browser has no policy here.
alter table public.avail_state       enable row level security;

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
-- ── visitor tally ──────────────────────────────────────────
-- the counter is built from four small tables and nothing else:
--   site_hits     one row per page view  -> views, paths, refs, langs, devices
--   site_visitors one row per (ip,day)    -> unique visitors, hashed and salted
--   site_days     one row per calendar day -> the trend chart
--   site_totals   one row, always id = 1  -> the two numbers the homepage shows
-- the homepage reads one row, so the count never becomes a scan.
-- the raw ip is never stored anywhere: the visitor key is
-- sha256(salt | ip | day), so a person cannot be followed from one
-- day to the next, and the same hash cannot be reversed to an ip.

create table if not exists public.site_hits (
  id         uuid primary key default gen_random_uuid(),
  ts         timestamptz not null default now(),
  day        date not null,                -- Baghdad calendar day
  uniq_day   text not null,                -- sha256(salt|ip|day), 32 hex chars
  path       text not null default '/',
  lang       text not null default 'en',
  ref_domain text,                         -- external referrer host, or null
  device     text,                         -- desktop|mobile|tablet|other
  browser    text                          -- chrome|edge|safari|firefox|samsung|other
);
create index if not exists site_hits_day_idx  on public.site_hits (day);
create index if not exists site_hits_uniq_idx on public.site_hits (uniq_day);
create index if not exists site_hits_path_idx on public.site_hits (path, day desc);

create table if not exists public.site_visitors (
  uniq_day  text primary key,              -- one row per visitor-day ever seen
  first_day date not null,
  seen_at   timestamptz not null default now()
);
create index if not exists site_visitors_day_idx on public.site_visitors (first_day desc);

create table if not exists public.site_days (
  day      date primary key,
  views    bigint not null default 0,
  visitors bigint not null default 0
);

create table if not exists public.site_totals (
  id         int primary key check (id = 1),
  views      bigint not null default 0,
  visitors   bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.site_totals (id, views, visitors)
  values (1, 0, 0) on conflict (id) do nothing;

-- ── one write per visit ────────────────────────────────────
-- record_hit does all four writes in a single transaction and hands
-- back the numbers the page prints, so the browser needs no read
-- policy and no second round trip. found is true only when the
-- visitor row was genuinely new, which is what makes "visitors"
-- count people and not reloads.
create or replace function public.record_hit(
  p_day      date,
  p_uniq     text,
  p_path     text,
  p_lang     text,
  p_ref      text,
  p_device   text,
  p_browser  text
) returns jsonb language plpgsql as $$
declare
  v_new  boolean;
  v_out  jsonb;
begin
  insert into public.site_hits (day, uniq_day, path, lang, ref_domain, device, browser)
    values (p_day, p_uniq, left(coalesce(p_path, '/'), 200),
            left(coalesce(p_lang, 'en'), 5),
            nullif(left(trim(coalesce(p_ref, '')), 80), ''),
            left(coalesce(p_device, 'other'), 12),
            left(coalesce(p_browser, 'other'), 12));

  insert into public.site_visitors (uniq_day, first_day)
    values (p_uniq, p_day)
    on conflict (uniq_day) do nothing;
  v_new := found;

  insert into public.site_totals (id, views, visitors, updated_at)
    values (1, 1, v_new::int, now())
    on conflict (id) do update
      set views    = public.site_totals.views + 1,
          visitors = public.site_totals.visitors + v_new::int,
          updated_at = now();

  insert into public.site_days (day, views, visitors)
    values (p_day, 1, v_new::int)
    on conflict (day) do update
      set views    = public.site_days.views + 1,
          visitors = public.site_days.visitors + v_new::int;

  select jsonb_build_object(
           'views',         t.views,
           'visitors',      t.visitors,
           'todayViews',    d.views,
           'todayVisitors', d.visitors
         )
    into v_out
    from public.site_totals t
    join public.site_days  d on d.day = p_day
    where t.id = 1;

  return v_out;
end $$;

-- ── the counter is read-only from the browser, and not even that ──
alter table public.site_hits     enable row level security;
alter table public.site_visitors enable row level security;
alter table public.site_days     enable row level security;
alter table public.site_totals   enable row level security;
-- no policies on any of the four: anon cannot select, insert, update
-- or delete a single row. every read and write goes through the
-- site-stats function with the service key.
-- site-stats is the only caller: revoke the default PUBLIC execute and
-- hand it back to the one role the edge function signs with.
revoke all on function public.record_hit(date, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_hit(date, text, text, text, text, text, text) to service_role;

-- ── hit-log aging ──────────────────────────────────────────
-- the raw log is the only bulky table; the day rows and the totals
-- stay forever, so the numbers never shrink when the log ages out.
create or replace function public.prune_site_hits(keep_days int default 180)
returns void language sql as $$
  delete from public.site_hits where ts < now() - make_interval(days => keep_days);
$$;


-- ── the weekly digest ──────────────────────────────────────
-- one row per day the digest letter went out. the function claims the day
-- before it composes anything, so a cron that fires twice — and a manual
-- retry on the same evening — send one letter and not three.
create table if not exists public.digest_state (
  day      date primary key,
  sent_at  timestamptz not null default now()
);
alter table public.digest_state enable row level security;
-- no policies: only the edge functions, signed with the service key,
-- read or write this table.

-- true for the caller that inserted the row, false for everyone after it
create or replace function public.claim_digest(p_day date)
returns boolean language plpgsql as $$
declare v_rows int;
begin
  insert into public.digest_state (day) values (p_day)
    on conflict (day) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

revoke all on function public.claim_digest(date) from public, anon, authenticated;
grant execute on function public.claim_digest(date) to service_role;
