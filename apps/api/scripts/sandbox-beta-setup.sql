-- =============================================================================
-- SANDBOX BETA ACCESS SETUP
-- Run this in the Supabase SQL Editor for the SANDBOX project only.
-- Sandbox Supabase project: ccxmfgaterriqownbtud
-- DO NOT run on the main / staging Supabase project.
-- =============================================================================

-- ── beta_testers: allowlist of permitted beta users ──────────────────────────
create table if not exists public.beta_testers (
  id               uuid        primary key default gen_random_uuid(),
  email            text        not null unique,
  status           text        not null default 'active',
  trial_starts_at  timestamptz default now(),
  trial_expires_at timestamptz,
  created_at       timestamptz default now()
);

alter table public.beta_testers enable row level security;

-- Authenticated users can read only their own row.
-- Used by client-side checks; server-side routes use the service role key.
create policy "beta_testers: read own row"
on public.beta_testers
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ── beta_user_sessions: scaffold for future login-sharing controls ────────────
-- No blocking enforced yet; rows accumulate for future analysis.
create table if not exists public.beta_user_sessions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null,
  email         text        not null,
  user_agent    text,
  ip_hash       text,
  first_seen_at timestamptz default now(),
  last_seen_at  timestamptz default now(),
  revoked_at    timestamptz,
  unique (user_id, user_agent)
);

alter table public.beta_user_sessions enable row level security;

-- No user-facing select/insert needed; only the service role key writes here.

-- ── is_active_beta_tester(): server-side helper ───────────────────────────────
-- Can be used in RLS policies on other tables to gate access to sandbox data.
-- Example: using (public.is_active_beta_tester())
create or replace function public.is_active_beta_tester()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.beta_testers bt
    where lower(bt.email) = lower(auth.jwt() ->> 'email')
      and bt.status = 'active'
      and (
        bt.trial_expires_at is null
        or bt.trial_expires_at > now()
      )
  );
$$;

-- ── Seed example ──────────────────────────────────────────────────────────────
-- Uncomment and edit to invite a beta tester.
-- Supabase user must also exist in auth.users (use create-supabase-user.sql).
--
-- insert into public.beta_testers (email, status, trial_starts_at, trial_expires_at)
-- values (
--   'tester@example.com',
--   'active',
--   now(),
--   now() + interval '14 days'
-- );
