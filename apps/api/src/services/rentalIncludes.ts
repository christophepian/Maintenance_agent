/**
 * G9: Canonical include trees for Rental Application queries.
 *
 * All queries that feed rental DTO mappers MUST use these constants.
 * If a DTO changes, update the matching include in the same PR.
 */

/* ── Application detail (full) ─────────────────────────────── */

export const RENTAL_APPLICATION_INCLUDE = {
  applicants: {
    include: {
      attachments: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  attachments: true,
  applicationUnits: {
    include: {
      unit: {
        include: {
          building: true,
        },
      },
    },
    orderBy: { rank: { sort: "asc" as const, nulls: "last" as const } },
  },
} as const;

/* ── Application unit detail ───────────────────────────────── */

export const RENTAL_APPLICATION_UNIT_INCLUDE = {
  application: {
    include: {
      applicants: {
        include: {
          attachments: true,
        },
      },
    },
  },
  unit: {
    include: {
      building: {
        include: {
          config: true,
        },
      },
    },
  },
} as const;

/* ── Owner selection detail ────────────────────────────────── */

export const RENTAL_OWNER_SELECTION_INCLUDE = {
  unit: {
    include: {
      building: true,
    },
  },
  primarySelection: {
    include: {
      application: {
        include: {
          applicants: true,
        },
      },
    },
  },
  backup1Selection: {
    include: {
      application: {
        include: {
          applicants: true,
        },
      },
    },
  },
  backup2Selection: {
    include: {
      application: {
        include: {
          applicants: true,
        },
      },
    },
  },
} as const;

/* ── Summary includes (for list views — lighter payloads) ──── */

export const RENTAL_APPLICATION_SUMMARY_SELECT = {
  id: true,
  orgId: true,
  createdAt: true,
  status: true,
  submittedAt: true,
  householdSize: true,
  applicants: {
    select: {
      id: true,
      role: true,
      firstName: true,
      lastName: true,
      netMonthlyIncome: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  applicationUnits: {
    select: {
      id: true,
      unitId: true,
      status: true,
      scoreTotal: true,
      confidenceScore: true,
      disqualified: true,
      rank: true,
    },
  },
} as const;
