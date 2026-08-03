/**
 * Sandbox routes — only active when SANDBOX_MODE=true.
 *
 * POST /sandbox/setup
 *   Creates placeholder Tenant + Contractor records for a new sandbox user and
 *   returns their IDs so the Next.js layer can write them to Supabase app_metadata.
 *   Idempotent: safe to call on every login.
 *
 * POST /sandbox/seed
 *   Populates realistic demo data (buildings, units, tenants, requests, jobs) in
 *   the caller's org. Idempotent: no-ops if seed data already exists.
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { requireAuth } from "../authz";
import { RequestStatus, RequestUrgency, JobStatus } from "@prisma/client";

const isSandbox = process.env.SANDBOX_MODE === "true";

function sandboxOnly(res: any): boolean {
  if (!isSandbox) {
    sendError(res, 403, "FORBIDDEN", "Sandbox routes are not enabled on this instance");
    return false;
  }
  return true;
}

export function registerSandboxRoutes(router: Router) {
  // Defense in depth: don't even register sandbox handlers unless this instance
  // is in sandbox mode. Off-sandbox the routes simply don't exist (404 at the
  // router level) rather than relying solely on the per-handler 403 guard.
  // (Audit CRITICAL_AUDIT_2026-06-23 — register sandbox routes only when enabled.)
  if (!isSandbox) {
    return;
  }

  /* ── POST /sandbox/setup ─────────────────────────────────────────────────── */
  router.post("/sandbox/setup", async ({ req, res, prisma, orgId }) => {
    if (!sandboxOnly(res)) return;
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      const email = user.email;
      const supabaseId = user.supabaseId ?? user.userId;
      // Stable placeholder phone — unique per Supabase user, fits the [orgId, phone] constraint
      const phone = `sbx-${supabaseId.slice(0, 12)}`;
      const displayName = email.split("@")[0] || "Sandbox User";

      // 1. Upsert User (MANAGER) — provides the ownerId for owner portal access
      const prismaUser = await (async () => {
        if (supabaseId && supabaseId !== user.userId) {
          // supabaseId is the Supabase UUID — unique in DB
          const existing = await prisma.user.findUnique({ where: { supabaseId } });
          if (existing) return existing;
        }
        const byEmail = email
          ? await prisma.user.findUnique({ where: { user_org_email_unique: { orgId, email } } })
          : null;
        if (byEmail) return byEmail;
        return prisma.user.create({
          data: { orgId, role: "MANAGER", name: displayName, email, supabaseId },
        });
      })();

      // 2. Upsert Tenant — unique on [orgId, phone]
      const tenant = await prisma.tenant.upsert({
        where: { orgId_phone: { orgId, phone } },
        create: { orgId, phone, email, name: displayName, isActive: true },
        update: { email },
      });

      // 3. Upsert Contractor — no unique on email; find-or-create by email + orgId
      const contractor = await (async () => {
        const existing = await prisma.contractor.findFirst({ where: { orgId, email } });
        if (existing) return existing;
        return prisma.contractor.create({
          data: {
            orgId,
            name: `${displayName} (sandbox)`,
            phone,
            email,
            serviceCategories: "General Maintenance",
            isActive: true,
          },
        });
      })();

      sendJson(res, 200, {
        data: {
          tenantId: tenant.id,
          contractorId: contractor.id,
          userId: prismaUser.id,
        },
      });
    } catch (e: any) {
      console.error("[sandbox/setup]", e);
      sendError(res, 500, "DB_ERROR", "Sandbox setup failed", String(e));
    }
  });

  /* ── POST /sandbox/seed ──────────────────────────────────────────────────── */
  router.post("/sandbox/seed", async ({ req, res, prisma, orgId }) => {
    if (!sandboxOnly(res)) return;
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      // Idempotency guard
      const existing = await prisma.building.findFirst({
        where: { orgId, name: "Tour Bellevue" },
      });
      if (existing) {
        return sendJson(res, 200, { data: { alreadySeeded: true } });
      }

      // 1. Buildings
      const [bldA, bldB] = await Promise.all([
        prisma.building.create({
          data: {
            orgId,
            name: "Tour Bellevue",
            address: "12 Route de Chêne",
            city: "Genève",
            postalCode: "1208",
            canton: "GE",
            yearBuilt: 1998,
          },
        }),
        prisma.building.create({
          data: {
            orgId,
            name: "Résidence du Lac",
            address: "8 Chemin du Lac",
            city: "Lausanne",
            postalCode: "1006",
            canton: "VD",
            yearBuilt: 2005,
          },
        }),
      ]);

      // 2. Units
      const [u1, u2, u3, u4, u5] = await Promise.all([
        prisma.unit.create({ data: { orgId, buildingId: bldA.id, unitNumber: "A101", floor: "1", rooms: 3 } }),
        prisma.unit.create({ data: { orgId, buildingId: bldA.id, unitNumber: "A202", floor: "2", rooms: 3.5 } }),
        prisma.unit.create({ data: { orgId, buildingId: bldA.id, unitNumber: "B301", floor: "3", rooms: 4 } }),
        prisma.unit.create({ data: { orgId, buildingId: bldB.id, unitNumber: "101",  floor: "1", rooms: 2.5 } }),
        prisma.unit.create({ data: { orgId, buildingId: bldB.id, unitNumber: "201",  floor: "2", rooms: 3 } }),
      ]);

      // 3. Tenants
      const [tA, tB] = await Promise.all([
        prisma.tenant.create({
          data: { orgId, name: "Marie Dubois", phone: "079 111 22 33", email: "marie.dubois@example.com", isActive: true },
        }),
        prisma.tenant.create({
          data: { orgId, name: "Pierre Martin", phone: "079 444 55 66", email: "pierre.martin@example.com", isActive: true },
        }),
      ]);

      // 4. Occupancies (tenants → units)
      await Promise.all([
        prisma.occupancy.create({ data: { tenantId: tA.id, unitId: u1.id } }),
        prisma.occupancy.create({ data: { tenantId: tB.id, unitId: u4.id } }),
      ]);

      // 5. Seed contractor (find the sandbox contractor for the current user, else create a generic one)
      const email = user.email;
      const seedContractor = await (async () => {
        const mine = await prisma.contractor.findFirst({ where: { orgId, email } });
        if (mine) return mine;
        return prisma.contractor.create({
          data: {
            orgId,
            name: "Techni-Fix Sàrl",
            phone: "022 999 00 11",
            email: "contact@technifix.ch",
            serviceCategories: "Plumbing, Electrical, General Maintenance",
            isActive: true,
          },
        });
      })();

      // 6. Requests in different states
      const now = new Date();
      const [rPending, rInProgress, rCompleted] = await Promise.all([
        prisma.request.create({
          data: {
            orgId,
            description: "Fuite sous l'évier de la cuisine — eau visible sous le meuble.",
            category: "Plumbing",
            status: RequestStatus.PENDING_REVIEW,
            tenantId: tA.id,
            unitId: u1.id,
            urgency: RequestUrgency.HIGH,
          },
        }),
        prisma.request.create({
          data: {
            orgId,
            description: "Radiateur du salon ne chauffe plus depuis une semaine.",
            category: "Heating",
            status: RequestStatus.ASSIGNED,
            tenantId: tB.id,
            unitId: u4.id,
            urgency: RequestUrgency.MEDIUM,
            assignedContractorId: seedContractor.id,
          },
        }),
        prisma.request.create({
          data: {
            orgId,
            description: "Remplacement de l'interrupteur de la chambre principale.",
            category: "Electrical",
            status: RequestStatus.COMPLETED,
            tenantId: tA.id,
            unitId: u1.id,
            urgency: RequestUrgency.LOW,
            assignedContractorId: seedContractor.id,
            completedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        }),
      ]);

      // 7. Job for the completed request
      await prisma.job.create({
        data: {
          orgId,
          requestId: rCompleted.id,
          contractorId: seedContractor.id,
          status: JobStatus.COMPLETED,
          actualCost: 28000, // CHF in cents
          completedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      });

      sendJson(res, 200, {
        data: {
          seeded: true,
          buildings: 2,
          units: 5,
          tenants: 2,
          requests: 3,
        },
      });
    } catch (e: any) {
      console.error("[sandbox/seed]", e);
      sendError(res, 500, "DB_ERROR", "Seed failed", String(e));
    }
  });
}
