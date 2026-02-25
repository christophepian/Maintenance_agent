import { PrismaClient } from "@prisma/client";

/**
 * Shared PrismaClient singleton.
 *
 * Every service module must import `prisma` from here instead of
 * calling `new PrismaClient()` locally. This avoids opening dozens
 * of independent connection pools (default 5 connections each) which
 * can exhaust PostgreSQL's connection limit under load.
 */
const prisma = new PrismaClient();

export default prisma;
