export default async function handler(req, res) {
  const { API_BASE_URL = 'http://127.0.0.1:3001' } = process.env;
  const { id, action } = req.query;

  // Build path: /leases/:id or /leases/:id/:action
  let backendPath = `/leases/${id}`;

  // Handle sub-actions passed as extra path segments
  // Next.js catch-all: id can be an array like ['uuid', 'generate-pdf']
  if (Array.isArray(id)) {
    const leaseId = id[0];
    const subAction = id.slice(1).join('/');
    backendPath = `/leases/${leaseId}${subAction ? '/' + subAction : ''}`;
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(`${API_BASE_URL}${backendPath}`, fetchOptions);

    // If the response is a PDF, stream it through
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/pdf')) {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', response.headers.get('content-disposition') || 'attachment; filename="lease.pdf"');
      const sha256 = response.headers.get('x-pdf-sha256');
      if (sha256) res.setHeader('x-pdf-sha256', sha256);
      const storageKey = response.headers.get('x-storage-key');
      if (storageKey) res.setHeader('x-storage-key', storageKey);
      return res.status(200).send(buffer);
    }

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
