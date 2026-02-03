import { PrismaClient } from "@prisma/client";

export type AssignmentInput = {
  contractorId: string;
};

/**
 * Find a contractor that can service a request category.
 * Returns the first active contractor with the matching category.
 */
export async function findMatchingContractor(
  prisma: PrismaClient,
  orgId: string,
  category: string
): Promise<{ id: string; name: string } | null> {
  const contractors = await prisma.contractor.findMany({
    where: {
      orgId,
      isActive: true,
    },
    select: { id: true, name: true, serviceCategories: true },
  });

  // Parse serviceCategories JSON and find matching contractor
  for (const contractor of contractors) {
    try {
      const categories = JSON.parse(contractor.serviceCategories || "[]");
      if (categories.includes(category)) {
        return { id: contractor.id, name: contractor.name };
      }
    } catch {
      // Skip contractor if JSON parse fails
      continue;
    }
  }

  return null;
}

/**
 * Assign a contractor to a request.
 */
export async function assignContractor(
  prisma: PrismaClient,
  requestId: string,
  contractorId: string
): Promise<{ success: boolean; message: string }> {
  // Verify contractor exists and is active
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
  });

  if (!contractor) {
    return { success: false, message: "Contractor not found" };
  }

  if (!contractor.isActive) {
    return { success: false, message: "Contractor is inactive" };
  }

  // Update request with assigned contractor
  await prisma.request.update({
    where: { id: requestId },
    data: { assignedContractorId: contractorId },
  });

  return { success: true, message: `Request assigned to ${contractor.name}` };
}

/**
 * Unassign a contractor from a request.
 */
export async function unassignContractor(
  prisma: PrismaClient,
  requestId: string
): Promise<{ success: boolean; message: string }> {
  await prisma.request.update({
    where: { id: requestId },
    data: { assignedContractorId: null },
  });

  return { success: true, message: "Contractor unassigned" };
}
