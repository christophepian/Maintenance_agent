-- Create a Supabase auth user manually (when invite emails are rate-limited).
--
-- Run in Supabase Dashboard → SQL Editor.
-- Replace ALL placeholder values before running.
--
-- After running, also set app_metadata (step 2) and the app-side User record (step 3).

-- ── Step 1: Insert auth user ───────────────────────────────────────────────
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  role,
  aud,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  -- Token columns must be empty strings, not NULL (GoTrue will fail to scan NULLs)
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  reauthentication_token,
  phone,
  phone_change,
  phone_change_token,
  email_change
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'USER_EMAIL',                                         -- ← replace
  crypt('TEMPORARY_PASSWORD', gen_salt('bf', 10)),      -- ← replace password
  now(),
  'authenticated',
  'authenticated',
  now(),
  now(),
  '{"appRole":"MANAGER","orgId":"default-org","accessLevel":"APP_USER"}',  -- ← adjust role
  '{}',
  '', '', '', '', '', '', '', '', ''
);

-- ── Step 1b: Fix any NULL token columns (GoTrue fails to scan NULLs) ────────
UPDATE auth.users
SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token     = COALESCE(reauthentication_token, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  email_change               = COALESCE(email_change, '')
  -- phone / phone_change intentionally omitted: unique constraint prevents empty string
WHERE email = 'USER_EMAIL';                             -- ← replace

-- ── Step 2: Insert identity record (required for password login) ───────────
INSERT INTO auth.identities (
  id, user_id, provider_id, provider,
  identity_data, created_at, updated_at, last_sign_in_at
)
SELECT
  gen_random_uuid(), id, email, 'email',
  jsonb_build_object('sub', id::text, 'email', email),
  now(), now(), now()
FROM auth.users
WHERE email = 'USER_EMAIL';                             -- ← replace

-- ── Step 3: Insert app-side User record ───────────────────────────────────
-- We link User.supabaseId → auth.users.id so the server can resolve the
-- Prisma User.id at login time (avoids app_metadata drift).
INSERT INTO "User" (id, "orgId", role, name, email, "supabaseId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'default-org',
  'MANAGER',                -- ← adjust: MANAGER | OWNER | CONTRACTOR | VENDOR
  'Full Name',              -- ← replace
  'USER_EMAIL',             -- ← replace
  au.id,                    -- links User.supabaseId = auth.users.id
  now(),
  now()
FROM auth.users au
WHERE au.email = 'USER_EMAIL'   -- ← replace
ON CONFLICT ("orgId", email) DO UPDATE SET "supabaseId" = EXCLUDED."supabaseId";

-- ── Step 4: Verify the link ────────────────────────────────────────────────
SELECT u.id AS "prismaUserId", u."supabaseId", u.role, au.id AS "supabaseAuthId"
FROM "User" u
JOIN auth.users au ON au.email = u.email
WHERE u.email = 'USER_EMAIL';   -- ← replace — supabaseId should match supabaseAuthId
