/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config');

// Content-Security-Policy — REPORT-ONLY for now (pre-GA). It does NOT block
// anything; the browser reports violations to the console so we can map the
// app's real resource origins before switching to an enforcing policy. Tighten
// here (remove 'unsafe-inline'/'unsafe-eval', add nonces) once staging traffic
// shows the policy is clean, then rename the header to Content-Security-Policy.
// See project_security_hardening memory + CRITICAL_AUDIT_2026-06-23.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Next.js hydration + the static investor pitchdeck need inline/eval today.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Google Fonts stylesheet host (Inter / DM Serif Display / Playfair Display wordmark)
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  // Google Fonts webfont files are served from fonts.gstatic.com
  "font-src 'self' data: https://fonts.gstatic.com",
  // Self (Next API proxies) + Supabase/Render over https (auth, storage).
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = [
  // Prevent the app from being embedded in an iframe (clickjacking defence)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from MIME-sniffing uploaded files away from their declared type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Only send the origin (no path) in the Referer header for cross-origin requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features the app does not use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Non-enforcing CSP — surfaces violations without breaking anything (pre-GA)
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
];

const nextConfig = {
  i18n,
  async headers() {
    return [
      {
        // Apply to every route, including API proxies and static assets
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async redirects() {
    return [
      // Legacy operations/* aliases retired in frontend-debt-cleanup slice
      { source: '/manager/operations/contractors', destination: '/manager/people/vendors', permanent: true },
      { source: '/manager/operations/inventory', destination: '/admin-inventory', permanent: true },
      { source: '/manager/operations/tenants', destination: '/manager/people/tenants', permanent: true },
      // Duplicate /contractors page retired — canonical is /manager/people/vendors
      { source: '/contractors', destination: '/manager/people/vendors', permanent: true },
      // Cashflow top-level page merged into Finance Planning tab
      { source: '/manager/cashflow', destination: '/manager/finance?tab=planning', permanent: true },
      // Tenant leases list + invoices list merged into My Home
      { source: '/tenant/leases', destination: '/tenant/myhome', permanent: true },
      { source: '/tenant/invoices', destination: '/tenant/myhome', permanent: true },
    ];
  },
};

module.exports = nextConfig;
