# Authentication & Testing Implementation — Feb 5, 2026

## Overview

Both authentication and automated testing frameworks have been scaffolded and integrated into the backend. These address the two critical gaps identified in the project audit.

---

## 1. Authentication Implementation

### What Was Added

- **Auth Service** (`apps/api/src/services/auth.ts`):
  - `TokenPayload` interface defining user identity structure
  - `encodeToken()` — creates tokens (demo impl; use jsonwebtoken in prod)
  - `decodeToken()` — verifies and extracts token claims
  - `extractToken()` — parses Authorization header

- **Auth Middleware** (`apps/api/src/auth.ts`):
  - `authMiddleware()` — optional; extracts token and attaches user to request
  - `requireAuth()` — enforces authentication on protected routes
  - `requireRole(role)` — enforces role-based access (TENANT, CONTRACTOR, MANAGER)

- **Prisma Schema Updates**:
  - Added `email` (optional, unique per org), `passwordHash`, `createdAt`, `updatedAt` to User model
  - Migration created and applied: `20260205142350_add_auth_to_user`

### Deployment Checklist

- [ ] Replace demo token encoding with `jsonwebtoken` library
- [ ] Add bcrypt for password hashing (`npm install bcrypt`)
- [ ] Implement `/auth/register` and `/auth/login` endpoints
- [ ] Wire `authMiddleware` into all protected routes in `server.ts`
- [ ] Set `AUTH_SECRET` env var in production
- [ ] Add JWT refresh token logic
- [ ] Implement logout/token revocation

---

## 2. Automated Testing Implementation

### What Was Added

- **Jest Configuration** (`jest.config.js`):
  - TypeScript support via `ts-jest`
  - Node environment
  - Test file pattern: `**/__tests__/**/*.test.ts`

- **Test Scripts** (`package.json`):
  - `npm test` — run all tests once
  - `npm run test:watch` — run tests in watch mode

- **Sample Integration Tests** (`src/__tests__/requests.test.ts`):
  - GET /requests endpoint test
  - GET /org-config endpoint test
  - GET /contractors endpoint test
  - Each includes error handling for when server is not running

- **Dependencies Installed**:
  - `jest@29.7.0` and `ts-jest@29.1.1`
  - `@types/jest@29.5.11` for TypeScript support

### Test Execution

```bash
# Run all tests once
npm test

# Run in watch mode (re-run on file changes)
npm run test:watch

# List all tests
npm test -- --listTests

# Run specific test file
npm test requests.test.ts

# Run with coverage
npm test -- --coverage
```

### Adding More Tests

Create files in `src/__tests__/` following the pattern `*.test.ts`:

```typescript
describe('Feature X', () => {
  it('should do something', () => {
    expect(value).toBe(expectedValue);
  });
});
```

### Deployment Checklist

- [ ] Add unit tests for validation schemas
- [ ] Add tests for core services (maintenanceRequests, contractors, etc.)
- [ ] Add database tests with test database or in-memory setup
- [ ] Set up test coverage thresholds in `jest.config.js`
- [ ] Integrate tests into CI/CD pipeline (GitHub Actions)
- [ ] Add pre-commit hooks to run tests

---

## 3. Running Tests Against Live Server

The sample tests are integration tests that hit the running backend on port 3001. To run them:

```bash
# Terminal 1: Start backend
cd apps/api
npm run start:dev

# Terminal 2: Run tests
npm test
```

Tests will gracefully handle connection errors if the server is not running.

---

## 4. Next Steps

### Immediate (This Week)
- Implement real token encoding with `jsonwebtoken`
- Add `/auth/login` and `/auth/register` endpoints
- Wire `authMiddleware` into server.ts for protected routes
- Add unit tests for validation schemas

### Short Term (Next Week)
- Add password hashing with bcrypt
- Implement role-based endpoint access
- Add tests for core services
- Set up test database for integration testing

### Medium Term
- Implement refresh token logic
- Add test coverage reporting
- Integrate tests into GitHub Actions CI/CD
- Add pre-commit test hooks

---

## 5. Code Locations

- **Auth service:** [apps/api/src/services/auth.ts](apps/api/src/services/auth.ts)
- **Auth middleware:** [apps/api/src/auth.ts](apps/api/src/auth.ts)
- **Jest config:** [apps/api/jest.config.js](apps/api/jest.config.js)
- **Sample tests:** [apps/api/src/__tests__/requests.test.ts](apps/api/src/__tests__/requests.test.ts)
- **Updated schema:** [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)
- **Updated package.json:** [apps/api/package.json](apps/api/package.json)

---

**Status:** ✅ Scaffolding complete. Ready for iterative implementation.
