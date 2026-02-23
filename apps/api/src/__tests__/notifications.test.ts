import { PrismaClient } from "@prisma/client";
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  notifyRequestApproved,
  notifyRequestPendingOwnerApproval,
  notifyInvoiceStatusChanged,
  notifyJobStatusChanged,
} from "../services/notifications";

const prisma = new PrismaClient();

describe("Notifications Service", () => {
  let orgId: string;
  let userId: string;
  let buildingId: string;
  let contractorId: string;
  let requestId: string;
  let jobId: string;
  let invoiceId: string;

  beforeAll(async () => {
    // Create org
    const org = await prisma.org.create({
      data: { name: "Test Org for Notifications" },
    });
    orgId = org.id;

    // Create building
    const building = await prisma.building.create({
      data: {
        orgId,
        name: "Test Building",
        address: "123 Test St",
      },
    });
    buildingId = building.id;

    // Create user
    const user = await prisma.user.create({
      data: {
        orgId,
        name: "Test User",
        role: "MANAGER",
        email: "test@example.com",
      },
    });
    userId = user.id;

    // Create contractor
    const contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "Test Contractor",
        phone: "+41800000000",
        email: "contractor@example.com",
        serviceCategories: "stove,oven",
      },
    });
    contractorId = contractor.id;

    // Create request (no orgId field in Request model)
    const request = await prisma.request.create({
      data: {
        description: "Test request",
        category: "stove",
        status: "PENDING_REVIEW",
      },
    });
    requestId = request.id;

    // Create job
    const job = await prisma.job.create({
      data: {
        requestId,
        contractorId,
        status: "PENDING",
        orgId,
      },
    });
    jobId = job.id;

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        jobId,
        orgId,
        recipientName: "Test Org",
        recipientAddressLine1: "Org Street 1",
        recipientPostalCode: "8000",
        recipientCity: "Zurich",
        recipientCountry: "CH",
        subtotalAmount: 10000,
        vatAmount: 770,
        totalAmount: 10770,
        currency: "CHF",
        vatRate: 7.7,
        amount: 108,
        description: "Test Invoice",
        status: "DRAFT",
      },
    });
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.notification.deleteMany({ where: { orgId } });
    await prisma.invoice.deleteMany({ where: { jobId } });
    await prisma.job.deleteMany({ where: { requestId } });
    await prisma.request.delete({ where: { id: requestId } }).catch(() => {});
    await prisma.contractor.delete({ where: { id: contractorId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("should create a notification", async () => {
    const notification = await createNotification({
      orgId,
      userId,
      buildingId,
      entityType: "REQUEST",
      entityId: requestId,
      eventType: "REQUEST_APPROVED",
      message: "Test notification",
    });

    expect(notification).toHaveProperty("id");
    expect(notification.orgId).toBe(orgId);
    expect(notification.userId).toBe(userId);
    expect(notification.buildingId).toBe(buildingId);
    expect(notification.eventType).toBe("REQUEST_APPROVED");
    expect(notification.readAt).toBeNull();
  });

  test("should get user notifications with pagination", async () => {
    // Create multiple notifications
    await createNotification({
      orgId,
      userId,
      buildingId,
      entityType: "REQUEST",
      entityId: requestId,
      eventType: "REQUEST_PENDING_REVIEW",
      message: "Notification 1",
    });

    await createNotification({
      orgId,
      userId,
      buildingId,
      entityType: "JOB",
      entityId: jobId,
      eventType: "JOB_CREATED",
      message: "Notification 2",
    });

    const result = await getUserNotifications({
      orgId,
      userId,
      limit: 10,
      offset: 0,
    });

    expect(result.notifications.length).toBeGreaterThanOrEqual(2);
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  test("should get unread notifications only", async () => {
    const allResult = await getUserNotifications({
      orgId,
      userId,
      limit: 100,
      offset: 0,
    });

    const unreadResult = await getUserNotifications({
      orgId,
      userId,
      unreadOnly: true,
      limit: 100,
      offset: 0,
    });

    expect(unreadResult.total).toBeLessThanOrEqual(allResult.total);
  });

  test("should mark notification as read", async () => {
    const notif = await createNotification({
      orgId,
      userId,
      buildingId,
      entityType: "REQUEST",
      entityId: requestId,
      eventType: "REQUEST_APPROVED",
      message: "Test for read",
    });

    const updated = await markNotificationAsRead(notif.id, orgId);
    expect(updated.readAt).not.toBeNull();
  });

  test("should get unread notification count", async () => {
    const beforeCount = await getUnreadNotificationCount(orgId, userId);

    // Create unread notification
    await createNotification({
      orgId,
      userId,
      buildingId,
      entityType: "INVOICE",
      entityId: invoiceId,
      eventType: "INVOICE_CREATED",
      message: "New invoice",
    });

    const afterCount = await getUnreadNotificationCount(orgId, userId);
    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  test("should mark all notifications as read", async () => {
    // Ensure we have some unread
    await createNotification({
      orgId,
      userId,
      buildingId,
      entityType: "REQUEST",
      entityId: requestId,
      eventType: "REQUEST_PENDING_OWNER_APPROVAL",
      message: "Batch test 1",
    });

    await createNotification({
      orgId,
      userId,
      buildingId,
      entityType: "JOB",
      entityId: jobId,
      eventType: "JOB_STARTED",
      message: "Batch test 2",
    });

    const countBefore = await getUnreadNotificationCount(orgId, userId);
    expect(countBefore).toBeGreaterThan(0);

    const marked = await markAllNotificationsAsRead(orgId, userId);
    expect(marked).toBeGreaterThan(0);

    const countAfter = await getUnreadNotificationCount(orgId, userId);
    expect(countAfter).toBe(0);
  });

  test("should delete notification", async () => {
    const notif = await createNotification({
      orgId,
      userId,
      buildingId,
      entityType: "REQUEST",
      entityId: requestId,
      eventType: "REQUEST_APPROVED",
      message: "To be deleted",
    });

    await deleteNotification(notif.id, orgId);

    const result = await getUserNotifications({
      orgId,
      userId,
      limit: 100,
      offset: 0,
    });

    const found = result.notifications.find((n) => n.id === notif.id);
    expect(found).toBeUndefined();
  });

  test("should enforce org scoping on read", async () => {
    const otherOrg = await prisma.org.create({
      data: { name: "Other Org" },
    });

    const notif = await createNotification({
      orgId,
      userId,
      buildingId,
      entityType: "REQUEST",
      entityId: requestId,
      eventType: "REQUEST_APPROVED",
      message: "Org scoped",
    });

    // Try to read with wrong org should fail
    try {
      await markNotificationAsRead(notif.id, otherOrg.id);
      fail("Should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("does not belong to this org");
    }

    // Cleanup
    await prisma.org.deleteMany({ where: { id: otherOrg.id } });
  });

  test("should enforce org scoping on delete", async () => {
    const otherOrg = await prisma.org.create({
      data: { name: "Other Org for Delete Test" },
    });

    const notif = await createNotification({
      orgId,
      userId,
      buildingId,
      entityType: "REQUEST",
      entityId: requestId,
      eventType: "CONTRACTOR_ASSIGNED",
      message: "Org scoped delete",
    });

    // Try to delete with wrong org should fail
    try {
      await deleteNotification(notif.id, otherOrg.id);
      fail("Should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("does not belong to this org");
    }

    // Cleanup
    await prisma.org.deleteMany({ where: { id: otherOrg.id } });
  });

  test("should trigger notification for request approval", async () => {
    const tenant = await prisma.user.create({
      data: {
        orgId,
        name: "Test Tenant",
        role: "TENANT",
        email: "tenant@example.com",
      },
    });

    const contractor = await prisma.user.create({
      data: {
        orgId,
        name: "Test Contractor",
        role: "CONTRACTOR",
        email: "contractor@example.com",
      },
    });

    // Create new request
    const newRequest = await prisma.request.create({
      data: {
        description: "Test for approval notification",
        category: "oven",
        status: "AUTO_APPROVED",
      },
    });

    // Trigger approval notifications
    await notifyRequestApproved(
      newRequest.id,
      orgId,
      tenant.id,
      contractor.id,
      buildingId
    );

    // Check tenant got notification
    const tenantNotifs = await getUserNotifications({
      orgId,
      userId: tenant.id,
      limit: 10,
      offset: 0,
    });
    const tenantNotif = tenantNotifs.notifications.find(
      (n) => n.entityId === newRequest.id && n.eventType === "REQUEST_APPROVED"
    );
    expect(tenantNotif).toBeDefined();

    // Check contractor got notification
    const contractorNotifs = await getUserNotifications({
      orgId,
      userId: contractor.id,
      limit: 10,
      offset: 0,
    });
    const contractorNotif = contractorNotifs.notifications.find(
      (n) =>
        n.entityId === newRequest.id &&
        n.eventType === "CONTRACTOR_ASSIGNED"
    );
    expect(contractorNotif).toBeDefined();

    // Cleanup
    await prisma.request.delete({ where: { id: newRequest.id } }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [tenant.id, contractor.id] } },
    });
  });

  test("should trigger notification for invoice status change", async () => {
    const owner = await prisma.user.create({
      data: {
        orgId,
        name: "Test Owner",
        role: "OWNER",
        email: "owner@example.com",
      },
    });

    await notifyInvoiceStatusChanged(
      invoiceId,
      orgId,
      owner.id,
      "INVOICE_CREATED",
      buildingId
    );

    const notifs = await getUserNotifications({
      orgId,
      userId: owner.id,
      limit: 10,
      offset: 0,
    });

    const found = notifs.notifications.find(
      (n) =>
        n.entityId === invoiceId &&
        n.eventType === "INVOICE_CREATED"
    );
    expect(found).toBeDefined();

    // Cleanup
    await prisma.user.delete({ where: { id: owner.id } });
  });

  test("should trigger notification for job status change", async () => {
    const manager = await prisma.user.create({
      data: {
        orgId,
        name: "Test Manager for Job",
        role: "MANAGER",
        email: "manager-job@example.com",
      },
    });

    await notifyJobStatusChanged(
      jobId,
      orgId,
      manager.id,
      "JOB_STARTED",
      buildingId
    );

    const notifs = await getUserNotifications({
      orgId,
      userId: manager.id,
      limit: 10,
      offset: 0,
    });

    const found = notifs.notifications.find(
      (n) => n.entityId === jobId && n.eventType === "JOB_STARTED"
    );
    expect(found).toBeDefined();

    // Cleanup
    await prisma.user.delete({ where: { id: manager.id } });
  });
});
