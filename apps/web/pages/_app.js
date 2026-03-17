import '../styles/globals.css';
import { useEffect } from 'react';

// DEV-ONLY: Bootstrap role-specific auth tokens so all portal sections
// (manager, owner, vendor) work without a login flow. Never runs in production.
//
// To test a role in the browser:
//   localStorage.setItem('authToken', localStorage.getItem('ownerToken')); location.reload()
// Reset with:
//   localStorage.clear(); location.reload()
//
// Tokens expire 2027-03-15. Bootstrap is expiry-aware — expired tokens are
// automatically replaced on next page load. Regenerate with:
//   cd apps/api && node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({userId:'d93436c1-6568-4dba-8e65-fd8d34e6be2b',orgId:'default-org',email:'manager@local.dev',role:'MANAGER'},'dev-secret-key-12345',{expiresIn:'365d'}))"
//   cd apps/api && node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({userId:'dev-owner',orgId:'default-org',email:'dev-owner@local',role:'OWNER'},'dev-secret-key-12345',{expiresIn:'365d'}))"
//   cd apps/api && node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({userId:'dev-vendor',orgId:'default-org',email:'dev-vendor@local',role:'VENDOR'},'dev-secret-key-12345',{expiresIn:'365d'}))"
//   cd apps/api && node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({userId:'dev-contractor',orgId:'default-org',email:'contractor@local.dev',role:'CONTRACTOR'},'dev-secret-key-12345',{expiresIn:'365d'}))"
//
// Adding a new role: add one entry to DEV_TOKENS + one seed user in prisma/seed.ts
// + one string to STAFF_ROLES in apps/api/src/authz.ts. Nothing else changes.
const DEV_TOKENS = {
  // Manager: canonical user d93436c1 (manager@local.dev) — expires 2027-03-15
  manager: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkOTM0MzZjMS02NTY4LTRkYmEtOGU2NS1mZDhkMzRlNmJlMmIiLCJvcmdJZCI6ImRlZmF1bHQtb3JnIiwiZW1haWwiOiJtYW5hZ2VyQGxvY2FsLmRldiIsInJvbGUiOiJNQU5BR0VSIiwiaWF0IjoxNzczNTc2NTk1LCJleHAiOjE4MDUxMTI1OTV9.KP2mq1cVMghAIMmCtD-vLhgwl19X0ThyG041bVdGszw',
  // Owner: dev-owner — expires 2027-03-15
  owner: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZXYtb3duZXIiLCJvcmdJZCI6ImRlZmF1bHQtb3JnIiwiZW1haWwiOiJkZXYtb3duZXJAbG9jYWwiLCJyb2xlIjoiT1dORVIiLCJpYXQiOjE3NzM1NzY1OTksImV4cCI6MTgwNTExMjU5OX0.UNcb7dq-md3xToBho-Uyt36PJKKg28JJrkBe5gLUkHE',
  // Vendor: dev-vendor — expires 2027-03-15
  vendor: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZXYtdmVuZG9yIiwib3JnSWQiOiJkZWZhdWx0LW9yZyIsImVtYWlsIjoiZGV2LXZlbmRvckBsb2NhbCIsInJvbGUiOiJWRU5ET1IiLCJpYXQiOjE3NzM1NzY2MDMsImV4cCI6MTgwNTExMjYwM30.uQImJZ82OJtnTo1tV_4OboYn8SZBFpOkltC-86zLkgk',
  // Contractor: dev-contractor (contractor@local.dev) — expires 2026-07-15
  contractor: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZXYtY29udHJhY3RvciIsIm9yZ0lkIjoiZGVmYXVsdC1vcmciLCJlbWFpbCI6ImNvbnRyYWN0b3JAbG9jYWwuZGV2Iiwicm9sZSI6IkNPTlRSQUNUT1IiLCJpYXQiOjE3NzM3NDUyMDYsImV4cCI6MTgwNTI4MTIwNn0.Lab9qMNqGaVHt98pDt7FwSDL6hfBut3Zc7X8_-gmHu8',
};

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    function needsRefresh(key) {
      const t = localStorage.getItem(key);
      if (!t) return true;
      try {
        const { exp } = JSON.parse(atob(t.split('.')[1]));
        return Date.now() > exp * 1000;
      } catch { return true; }
    }

    // Expiry-aware bootstrap: replace missing or expired tokens automatically
    if (needsRefresh('authToken')) localStorage.setItem('authToken', DEV_TOKENS.manager);
    if (needsRefresh('ownerToken')) localStorage.setItem('ownerToken', DEV_TOKENS.owner);
    if (needsRefresh('vendorToken')) localStorage.setItem('vendorToken', DEV_TOKENS.vendor);
    if (needsRefresh('contractorToken')) localStorage.setItem('contractorToken', DEV_TOKENS.contractor);
  }, []);

  return <Component {...pageProps} />;
}