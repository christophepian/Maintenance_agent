-- Backfill User.supabaseId for all existing users by matching on email.
--
-- Run once in the Supabase SQL Editor (or via psql against the production DB).
-- Safe to re-run — the UPDATE is idempotent.
--
-- After running, the server-side resolvePrismaUserId() cache will pick up
-- correct Prisma User.ids on the next request per user, so notifications
-- and any other userId-scoped queries will start returning correct results.

UPDATE "User" u
SET "supabaseId" = au.id
FROM auth.users au
WHERE au.email = u.email
  AND (u."supabaseId" IS NULL OR u."supabaseId" <> au.id::text);

-- Verify: should return 0 rows if everything is linked.
SELECT u.id AS "prismaUserId", u.email, u."supabaseId"
FROM "User" u
WHERE u."supabaseId" IS NULL;
