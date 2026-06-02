/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config');

const SECURITY_HEADERS = [
  // Prevent the app from being embedded in an iframe (clickjacking defence)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from MIME-sniffing uploaded files away from their declared type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Only send the origin (no path) in the Referer header for cross-origin requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features the app does not use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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
