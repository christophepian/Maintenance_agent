# Project Audit Report

**Date:** 2026-02-02  
**Scope:** Structure, duplicates, and future-proofing

---

## Executive Summary

✅ **Overall:** Structure is clean and mostly sound. Minor issues with legacy backup code and configuration scattered across environments.

⚠️ **Action Items:**
1. Remove `_archive/` folder (legacy backup of early server.ts)
2. Delete disabled files (`prisma.service.ts.disabled`)
3. Remove `.gitignore.save` backup
4. Add `.env.local` to root `.gitignore` (currently only in `.env` pattern)
5. Clean up package.json scripts pointing to disabled NestJS build
6. Add root-level `tsconfig.json` for monorepo consistency

---

## Issues Found

### 1. **Dead Code & Legacy Backups**

| Item | Location | Issue | Recommendation |
|------|----------|-------|---|
| Legacy server backup | `_archive/apps_api_src_apps_backup/api/src/server.ts` | Obsolete copy of early HTTP server; causes confusion about which server.ts is active | **Delete entire `_archive/` folder** |
| Disabled Prisma service | `apps/api/src/prisma.service.ts.disabled` | Was part of abandoned NestJS integration; misleading name suggests it might be used | **Delete file** |
| Gitignore backup | `apps/api/.gitignore.save` | Leftover from manual configuration change; not needed with version control | **Delete file** |

### 2. **Inactive NestJS Scaffolding**

The codebase has NestJS setup that is **never used at runtime**, but references persist:

| File | Status | Note |
|------|--------|------|
| `apps/api/src/app.module.ts` | Unused | NestJS module definition, not imported anywhere |
| `apps/api/src/main.ts` | Unused | NestJS bootstrap file, never called in dev/prod |
| `apps/api/src/requests/requests.controller.ts` | Unused | NestJS decorator, minimal stub |
| `apps/api/src/requests/requests.module.ts` | Unused | NestJS module, never imported |
| `apps/api/package.json` scripts | Misleading | `start:dev: nest start --watch` and `build: nest build` don't match actual workflow |

**Impact:** New developers might try `npm run start:dev` expecting NestJS integration.

**Recommendation:** 
- Update `apps/api/package.json` scripts to use `ts-node` directly
- Consider removing all NestJS files or clearly document they're abandoned
- See detailed recommendations below

### 3. **Environment Configuration Issues**

| File | Location | Issue |
|------|----------|-------|
| `.env.local` | `apps/web/` | Contains `API_BASE_URL=http://localhost:3001`; not in root `.gitignore` |
| `.env` | `apps/api/` | Properly ignored by root `.gitignore` |
| `.env.example` | `apps/api/` | Good practice; example provided |

**Impact:** `.env.local` in Next.js can leak to version control if root `.gitignore` is bypassed.

**Recommendation:** Ensure `.env.local` is explicitly ignored at root level.

### 4. **No Monorepo Root Configuration**

- Missing root `tsconfig.json` for TypeScript project references
- Missing root `package.json` with workspace/npm workspace config
- Each app has independent `tsconfig.json` with no cross-app reference support

**Impact:** Future shared packages in `/packages/` will have friction.

**Recommendation:** Add root `tsconfig.json` with `references` and consider npm workspaces.

### 5. **Build Artifact Handling**

The root `.gitignore` has blanket rules:
```ignore
**/*.js
**/*.js.map
**/*.d.ts
```

This is **too aggressive** for a monorepo. It will catch:
- Next.js `.next/` output ❌ (correctly ignored, but the .gitignore rule is overkill)
- Accidentally prevent shipping `.js` files if they become necessary in the future

**Recommendation:** Use more precise patterns:
```ignore
# TypeScript outputs in dev (ts-node compiles in memory, dist/ is build output)
dist/
*.d.ts
*.d.ts.map

# Next.js build
apps/web/.next/
```

### 6. **Frontend Routes Structure**

Pages under `apps/web/pages/api/requests/[id]/` exist but are empty. This is OK for future expansion, but:
- No `GET /api/requests/[id]` endpoint documented
- Backend supports `GET /requests/{id}` but frontend route is undefined

**Recommendation:** Either implement or document why `[id]/` exists but is unused.

---

## Future-Proofing Improvements

### Immediate (High Priority)

1. **Update `apps/api/package.json` scripts:**
   ```json
   {
     "start:dev": "ts-node src/server.ts",
     "build": "tsc",
     "start": "node dist/server.js"
   }
   ```
   Remove NestJS references; make actual dev workflow explicit.

2. **Delete legacy code:**
   ```bash
   rm -rf _archive/
   rm apps/api/src/prisma.service.ts.disabled
   rm apps/api/.gitignore.save
   ```

3. **Update root `.gitignore`:**
   ```ignore
   # API build
   apps/api/dist/
   
   # Environment files
   .env
   .env.local
   .env.*.local
   
   # OS
   .DS_Store
   
   # IDE
   .idea
   .vscode
   ```

### Medium Priority

4. **Add root `tsconfig.json`:**
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ESNext",
       "lib": ["ES2020"],
       "skipLibCheck": true,
       "strict": true,
       "moduleResolution": "bundler"
     },
     "files": [],
     "references": [
       { "path": "apps/api" },
       { "path": "apps/web" }
     ]
   }
   ```

5. **Add root `package.json` with workspace metadata:**
   ```json
   {
     "name": "maintenance-agent",
     "private": true,
     "workspaces": ["apps/*", "packages/*"],
     "scripts": {
       "dev": "concurrently 'cd apps/api && npm run start:dev' 'cd apps/web && npm run dev'"
     }
   }
   ```

### Low Priority (Nice-to-Have)

6. **Remove unused NestJS files** once confident they're truly abandoned:
   - `apps/api/src/app.module.ts`
   - `apps/api/src/main.ts`
   - `apps/api/src/requests/`
   - Remove `@nestjs/*` from `package.json`

7. **Clarify `apps/web/pages/api/requests/[id]/`:**
   - Either implement `GET /api/requests/[id]` handler
   - Or delete the empty directory

---

## Current State Summary

| Metric | Status |
|--------|--------|
| Duplicate files | ✅ Only `_archive/` (acceptable, but removable) |
| Disabled code | ⚠️ `prisma.service.ts.disabled` and NestJS scaffolding (non-breaking, but confusing) |
| Environment safety | ⚠️ `.env.local` not explicitly in root `.gitignore` |
| Monorepo readiness | ⚠️ No root `tsconfig.json` or workspace config |
| Build artifact handling | ⚠️ Overly broad `.js` rule in `.gitignore` |
| Documentation | ✅ Good (PROJECT_STATE.md, copilot-instructions.md) |
| Backend routing | ✅ Clean raw HTTP pattern, no framework bloat |
| Database migrations | ✅ Properly tracked in `prisma/migrations/` |

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|-----------|
| New dev runs `npm run start:dev` expecting NestJS | Medium | High | Update package.json, clarify docs |
| `.env.local` committed to git | Medium | Low | Add to root `.gitignore` |
| Confusion about which `server.ts` is active | Low | Medium | Delete `_archive/` folder |
| Scaling to multi-package monorepo | Medium | Medium | Add root `tsconfig.json` early |

---

## Recommendation Priority

1. **Week 1:** Delete `_archive/`, `.gitignore.save`, `prisma.service.ts.disabled`; update package.json scripts
2. **Week 2:** Add root `tsconfig.json` and root `package.json` with workspaces
3. **Week 3:** Implement or clarify `apps/web/pages/api/requests/[id]/`

This will make the codebase clean, scalable, and less confusing for future developers.
