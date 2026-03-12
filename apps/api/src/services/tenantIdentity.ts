/**
 * Tenant identity resolution helpers.
 *
 * Used by notification workflows and tenant-portal routes
 * to map a Tenant record id to the User id used for notifications.
 */

import { PrismaClient } from "@prisma/client";

/**
 * Resolve a tenantId to a userId for notification lookups.
 * Tries: 1) direct User with id=tenantId, 2) User with matching tenant email, 3) falls back to tenantId.
 */
export async function resolveTenantUserId(
  prisma: PrismaClient,
  orgId: string,
  tenantId: string,
): Promise<string> {
  // First check if tenantId is already a User id
  const directUser = await prisma.user.findFirst({
    where: { id: tenantId, orgId },
    select: { id: true },
  });
  if (directUser) return directUser.id;

  // Look up the tenant record to get their email
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { email: true },
  });
  if (tenant?.email) {
    const userByEmail = await prisma.user.findFirst({
      where: { orgId, email: tenant.email, role: "TENANT" },
      select: { id: true },
    });
    if (userByEmail) return userByEmail.id;
  }

  // Fallback: use tenantId as userId (notifications will still be created with this id)
  return tenantId;
}
