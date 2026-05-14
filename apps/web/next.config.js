/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config');

const nextConfig = {
  i18n,
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
