export default async function handler(req, res) {
  const { API_BASE_URL = 'http://127.0.0.1:3001' } = process.env;
  const { id } = req.query;

  // Handle catch-all: id can be ['uuid'] or ['uuid', 'send'] or ['uuid', 'mark-signed']
  let backendPath = '/signature-requests';
  if (Array.isArray(id)) {
    backendPath += '/' + id.join('/');
  } else {
    backendPath += '/' + id;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${backendPath}`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
