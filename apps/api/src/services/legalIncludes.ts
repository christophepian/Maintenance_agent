/**
 * G9: Canonical include trees for Legal Engine queries.
 *
 * All queries that feed legal/RFP DTO mappers MUST use these constants.
 * If a DTO changes, update the matching include in the same PR.
 *
 * NOTE: RFP_INCLUDE moved to repositories/rfpRepository.ts (rfp-manager-view slice).
 */

/* ── Request context for legal decision evaluation ─────────── */

export const REQUEST_LEGAL_DECISION_INCLUDE = {
  unit: {
    select: {
      id: true,
      unitNumber: true,
      buildingId: true,
      orgId: true,
      building: {
        select: {
          id: true,
          name: true,
          address: true,
          canton: true,
          cantonDerivedAt: true,
          orgId: true,
          config: {
            select: {
              rfpDefaultInviteCount: true,
            },
          },
        },
      },
    },
  },
  appliance: {
    select: {
      id: true,
      name: true,
      serial: true,
      installDate: true,
      assetModel: {
        select: {
          id: true,
          manufacturer: true,
          model: true,
          category: true,
        },
      },
    },
  },
  tenant: {
    select: {
      id: true,
      name: true,
      orgId: true,
    },
  },
} as const;

// NOTE: RFP_INCLUDE has moved to repositories/rfpRepository.ts as RFP_FULL_INCLUDE.
// Re-exported from services/rfps.ts for backward compatibility.
