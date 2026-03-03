import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;

  // Build path: /leases/:id or /leases/:id/:action
  // Next.js catch-all: id can be an array like ['uuid', 'generate-pdf']
  let backendPath = `/leases/${id}`;
  if (Array.isArray(id)) {
    const leaseId = id[0];
    const subAction = id.slice(1).join('/');
    backendPath = `/leases/${leaseId}${subAction ? '/' + subAction : ''}`;
  }

  // H3: Use shared proxy helper with binary support for PDFs
  await proxyToBackend(req, res, backendPath, { binary: true });
}
