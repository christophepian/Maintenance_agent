export default async function handler(req, res) {
  const { API_BASE_URL = 'http://127.0.0.1:3001' } = process.env;
  const { id } = req.query;

  // Build path: /tenant-portal/leases/:id or /tenant-portal/leases/:id/accept
  let backendPath = `/tenant-portal/leases/${id}`;

  // Next.js catch-all: id can be an array like ['uuid', 'accept']
  if (Array.isArray(id)) {
    const leaseId = id[0];
    const subAction = id.slice(1).join('/');
    backendPath = `/tenant-portal/leases/${leaseId}${subAction ? '/' + subAction : ''}`;
  }

  try {
    const qs = req.url.includes('?') ? '?' + req.url.split('?').slice(1).join('?') : '';
    // Strip Next.js catch-all params from query
    const cleanQs = qs.replace(/[?&]id=[^&]*/g, '').replace(/^\?&/, '?').replace(/^&/, '?');

    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(`${API_BASE_URL}${backendPath}${cleanQs}`, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
