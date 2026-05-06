-- AlterTable: add supabaseId linking User to Supabase auth.users
ALTER TABLE "User" ADD COLUMN "supabaseId" TEXT;

-- CreateIndex: enforce uniqueness so each Supabase user maps to at most one Prisma User
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");
