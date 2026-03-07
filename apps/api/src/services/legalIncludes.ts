/**
 * G9: Canonical include trees for Legal Engine queries.
 *
 * All queries that feed legal/RFP DTO mappers MUST use these constants.
 * If a DTO changes, update the matching include in the same PR.
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

/* ── RFP with invites and quotes ───────────────────────────── */

export const RFP_INCLUDE = {
  invites: {
    include: {
      contractor: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
  },
  quotes: {
    include: {
      contractor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { amountCents: "asc" as const },
  },
  building: {
    select: {
      id: true,
      name: true,
      address: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
    },
  },
  awardedContractor: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;
