/**
 * User Repository
 *
 * Centralizes all Prisma access for the User entity.
 */

import { PrismaClient, Role } from "@prisma/client";

export const USER_PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

/**
 * Find a user by id + orgId, returning public profile fields.
 */
export async function findUserProfile(
  prisma: PrismaClient,
  userId: string,
  orgId: string,
) {
  return prisma.user.findFirst({
    where: { id: userId, orgId },
    select: USER_PROFILE_SELECT,
  });
}

/**
 * Find a user by id + orgId, returning only id + passwordHash for
 * credential verification during password-change operations.
 */
export async function findUserForCredentialCheck(
  prisma: PrismaClient,
  userId: string,
  orgId: string,
) {
  return prisma.user.findFirst({
    where: { id: userId, orgId },
    select: { id: true, passwordHash: true },
  });
}

/**
 * Update user profile fields (name, email, passwordHash).
 * Returns the updated public profile.
 */
export async function updateUserProfile(
  prisma: PrismaClient,
  userId: string,
  data: { name?: string; email?: string; passwordHash?: string },
) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: USER_PROFILE_SELECT,
  });
}

// ─── Auth helpers ──────────────────────────────────────────────

/**
 * Create a new user.
 */
export async function createUser(
  prisma: PrismaClient,
  data: {
    orgId: string;
    email: string;
    name: string;
    passwordHash: string;
    role: Role;
  },
) {
  return prisma.user.create({ data });
}

/**
 * Find a user by org + email (unique constraint) for login.
 */
export async function findUserByOrgEmail(
  prisma: PrismaClient,
  orgId: string,
  email: string,
) {
  return prisma.user.findUnique({
    where: { user_org_email_unique: { orgId, email } },
  });
}

/**
 * Find all MANAGER-role users in an org.
 */
export async function findManagersByOrg(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.user.findMany({
    where: { orgId, role: "MANAGER" },
    select: { id: true, email: true },
  });
}

/**
 * Find all owner users for an org.
 */
export async function findOwnersByOrg(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.user.findMany({
    where: { orgId, role: "OWNER" },
    select: { id: true },
  });
}

