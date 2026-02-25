export default async function handler(req, res) {
  const { API_BASE_URL = 'http://127.0.0.1:3001' } = process.env;

  try {
    const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const response = await fetch(`${API_BASE_URL}/tenant-portal/leases${qs}`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
