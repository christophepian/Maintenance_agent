/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Legacy operations/* aliases retired in frontend-debt-cleanup slice
      { source: '/manager/operations/contractors', destination: '/manager/people/vendors', permanent: true },
      { source: '/manager/operations/inventory', destination: '/admin-inventory', permanent: true },
      { source: '/manager/operations/tenants', destination: '/manager/people/tenants', permanent: true },
      // Duplicate /contractors page retired — canonical is /manager/people/vendors
      { source: '/contractors', destination: '/manager/people/vendors', permanent: true },
    ];
  },
};

module.exports = nextConfig;
