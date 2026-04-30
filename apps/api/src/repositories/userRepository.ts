/**
 * User Repository
 *
 * Centralizes all Prisma access for the User entity.
 */

import { PrismaClient } from "@prisma/client";

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
