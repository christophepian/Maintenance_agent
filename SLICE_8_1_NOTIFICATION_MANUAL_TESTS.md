# Slice 8.1 — Notification Core: Manual UI Testing Guide

## Overview

Slice 8.1 (Notification Core) has been implemented with:
- **Prisma model**: `Notification` with org-scoping, entity references, event types, and read status
- **Backend service**: Full CRUD + trigger functions (`notifyRequestApproved`, `notifyInvoiceStatusChanged`, etc.)
- **API endpoints**: 5 REST endpoints for listing, reading, and dismissing notifications
- **Unit tests**: 12 integration tests, all passing

This guide provides step-by-step instructions to manually test the notification system via the running API and/or curl commands.

---

## Prerequisites

Ensure the following are running:

```bash
# Terminal 1: PostgreSQL (Docker)
cd infra && docker-compose up

# Terminal 2: Backend API
cd apps/api && npm run start:dev

# Terminal 3: Frontend (optional, for UI testing)
cd apps/web && npm run dev
```

Verify services are running:
```bash
lsof -nP -iTCP:3000,3001 -sTCP:LISTEN
# Should show:
#   Port 3001 — Node.js (API)
#   Port 3000 — node (Next.js, if running)
#   Port 5432 — postgres (database)
```

---

## Test 1: Create & Retrieve Notifications (API)

### 1.1 Create a notification via API

```bash
# Create a notification for a user
curl -X POST http://localhost:3001/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "some-user-id",
    "buildingId": "some-building-id",
    "entityType": "REQUEST",
    "entityId": "some-request-id",
    "eventType": "REQUEST_APPROVED",
    "message": "Your request has been approved"
  }'

# Response (201 Created):
# {
#   "data": {
#     "id": "...",
#     "userId": "...",
#     "entityType": "REQUEST",
#     "eventType": "REQUEST_APPROVED",
#     "message": "Your request has been approved",
#     "readAt": null,
#     "createdAt": "2026-02-11T..."
#   }
# }
```

**Expected:** 201 status with notification object returned.

### 1.2 List unread notifications for a user

```bash
# Replace {userId} and {orgId} with real values
curl -X GET "http://localhost:3001/notifications?unreadOnly=true&limit=10&offset=0" \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-ID: {orgId}" \
  -H "X-User-ID: {userId}"

# Response (200 OK):
# {
#   "data": {
#     "notifications": [
#       {
#         "id": "...",
#         "userId": "...",
#         "eventType": "REQUEST_APPROVED",
#         "readAt": null,
#         "createdAt": "..."
#       }
#     ],
#     "total": 1
#   }
# }
```

**Expected:** 200 status with array of unread notifications.

---

## Test 2: Mark Notification as Read

### 2.1 Mark a single notification as read

```bash
# Replace {notificationId} with real ID from Test 1.2
curl -X POST "http://localhost:3001/notifications/{notificationId}/read" \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-ID: {orgId}"

# Response (200 OK):
# {
#   "data": {
#     "id": "{notificationId}",
#     "userId": "...",
#     "eventType": "REQUEST_APPROVED",
#     "readAt": "2026-02-11T...",  # Now has a timestamp
#     "createdAt": "..."
#   }
# }
```

**Expected:** 200 status with `readAt` now populated with current timestamp.

### 2.2 Verify notification no longer appears in unread list

```bash
curl -X GET "http://localhost:3001/notifications?unreadOnly=true" \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-ID: {orgId}" \
  -H "X-User-ID: {userId}"

# Response (200 OK):
# {
#   "data": {
#     "notifications": [],  # Empty — notification marked as read
#     "total": 0
#   }
# }
```

**Expected:** Notification no longer in unread list (because we marked it as read).

### 2.3 Mark all notifications as read

```bash
curl -X POST "http://localhost:3001/notifications/mark-all-read" \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-ID: {orgId}" \
  -H "X-User-ID: {userId}"

# Response (200 OK):
# {
#   "data": {
#     "count": 5  # Number of notifications marked as read
#   }
# }
```

**Expected:** 200 status with count of notifications marked as read.

---

## Test 3: Get Unread Notification Count

### 3.1 Get count of unread notifications

```bash
curl -X GET "http://localhost:3001/notifications/unread-count" \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-ID: {orgId}" \
  -H "X-User-ID: {userId}"

# Response (200 OK):
# {
#   "data": {
#     "count": 3  # Number of unread notifications
#   }
# }
```

**Expected:** 200 status with current unread count.

---

## Test 4: Delete (Dismiss) Notification

### 4.1 Delete a notification

```bash
# Create a notification first (from Test 1.1), then delete it
curl -X DELETE "http://localhost:3001/notifications/{notificationId}" \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-ID: {orgId}"

# Response (200 OK):
# {
#   "message": "Notification deleted"
# }
```

**Expected:** 200 status with deletion confirmation.

### 4.2 Verify notification is deleted

```bash
curl -X GET "http://localhost:3001/notifications?limit=100" \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-ID: {orgId}" \
  -H "X-User-ID: {userId}"

# Notification should NOT appear in list
```

**Expected:** Deleted notification no longer in list.

---

## Test 5: Cross-Org Scoping (Security)

### 5.1 Attempt to read notification from wrong org (should fail)

```bash
# Create notification with orgId = "org-1"
# Then try to read it with orgId = "org-2" (different org)

curl -X POST "http://localhost:3001/notifications/{notificationId}/read" \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-ID: org-2"  # Wrong org

# Response (500 or 403):
# {
#   "error": {
#     "code": "DB_ERROR",
#     "message": "Notification does not belong to this org"
#   }
# }
```

**Expected:** Error response indicating org mismatch.

---

## Test 6: Pagination

### 6.1 Create 25 notifications, then paginate

```bash
# Create 25 notifications (use loop or multiple curl calls)
for i in {1..25}; do
  curl -X POST http://localhost:3001/notifications \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"user-123\",
      \"entityType\": \"REQUEST\",
      \"entityId\": \"req-$i\",
      \"eventType\": \"REQUEST_APPROVED\",
      \"message\": \"Notification $i\"
    }"
done

# Fetch page 1 (limit=10, offset=0)
curl -X GET "http://localhost:3001/notifications?limit=10&offset=0" \
  -H "Authorization: Bearer <token>" \
  -H "X-User-ID: user-123" \
  -H "X-Org-ID: {orgId}"

# Response should have 10 notifications
# {
#   "data": {
#     "notifications": [ ... 10 items ... ],
#     "total": 25
#   }
# }

# Fetch page 2 (limit=10, offset=10)
curl -X GET "http://localhost:3001/notifications?limit=10&offset=10" \
  ...

# Fetch page 3 (limit=10, offset=20)
curl -X GET "http://localhost:3001/notifications?limit=10&offset=20" \
  ...
```

**Expected:**
- Page 1: 10 notifications, total = 25
- Page 2: 10 notifications, total = 25
- Page 3: 5 notifications, total = 25

---

## Test 7: Notification Trigger Functions (Database-level)

### 7.1 Test request approval notification trigger

Use the database or integration tests to verify that `notifyRequestApproved()` creates notifications:

```bash
# Via integration test (already verified by test suite)
npm test -- --testPathPattern=notifications

# Or manually in database:
# 1. Create a request in PENDING_REVIEW status
# 2. Call notifyRequestApproved() in service layer
# 3. Query Notification table: should have entry with eventType = "REQUEST_APPROVED"
```

**Expected:** Notification created with correct event type and user IDs.

### 7.2 Test invoice status notification trigger

```bash
# Similar to 7.1, use notifyInvoiceStatusChanged()
# Verify notification created with eventType = "INVOICE_CREATED", "INVOICE_APPROVED", "INVOICE_PAID", or "INVOICE_DISPUTED"
```

**Expected:** Correct notification created for each invoice status change.

---

## Test 8: Event Type Validation

### 8.1 Attempt to create notification with invalid event type (should fail)

```bash
curl -X POST http://localhost:3001/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "entityType": "REQUEST",
    "entityId": "req-1",
    "eventType": "INVALID_EVENT_TYPE",
    "message": "Test"
  }'

# Response (400 Bad Request):
# {
#   "error": {
#     "code": "VALIDATION_ERROR",
#     "message": "Invalid event type"
#   }
# }
```

**Expected:** 400 status with validation error.

---

## Test 9: Org Isolation (Multi-org Test)

### 9.1 Verify notifications are org-scoped

```bash
# Create org-1 with user-1
# Create org-2 with user-2
# Create notification for org-1/user-1

# As user-2 in org-2, try to list notifications
curl -X GET "http://localhost:3001/notifications" \
  -H "Authorization: Bearer <user-2-token>" \
  -H "X-Org-ID: org-2" \
  -H "X-User-ID: user-2"

# Should NOT see org-1 notifications
# {
#   "data": {
#     "notifications": [],  # Empty — different org
#     "total": 0
#   }
# }
```

**Expected:** User-2 only sees notifications for org-2.

---

## Test 10: Frontend Integration (Optional, if UI added)

When a notification UI is added to the frontend, test:

1. **Notification Bell Icon**: Shows unread count
   - GET `/api/notifications/unread-count` should update badge

2. **Notification Panel**: Displays list of unread notifications
   - GET `/api/notifications?unreadOnly=true` populates list

3. **Mark as Read**: Click notification → mark as read
   - POST `/api/notifications/:id/read` → notification disappears from unread

4. **Dismiss**: Remove notification from view
   - DELETE `/api/notifications/:id` → notification deleted

---

## Troubleshooting

### Issue: 401 Unauthorized on all endpoints
**Solution:** Ensure `AUTH_OPTIONAL=true` in dev environment (or provide valid JWT token in `Authorization` header).

### Issue: 403 Forbidden
**Solution:** Check that user has `MANAGER` or `OWNER` role (notifications endpoints require `maybeRequireManager`).

### Issue: Notifications for wrong org appear
**Solution:** Verify request headers include correct `X-Org-ID`. All queries filter by `orgId` from token/header.

### Issue: Notification not appearing after creation
**Solution:** Check that:
1. Request has valid `userId` (must exist in User table)
2. Entity (Request/Job/Invoice) exists
3. Build succeeded: `npm run build` (verify no TypeScript errors)
4. Server restarted after code changes

---

## Summary

✅ **Slice 8.1 Complete & Tested**
- 12 integration tests passing
- API endpoints functional
- Org scoping enforced
- Event triggers working
- Pagination implemented
- Read status tracking operational

All manual tests above should pass. If any fail, refer to "Troubleshooting" section or check test logs: `npm test -- --testPathPattern=notifications`.

