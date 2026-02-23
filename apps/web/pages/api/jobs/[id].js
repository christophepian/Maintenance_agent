export default async function handler(req, res) {
  const { API_BASE_URL = 'http://127.0.0.1:3001' } = process.env;
  const { id } = req.query;

  try {
    const url = id ? `${API_BASE_URL}/jobs/${id}` : `${API_BASE_URL}/jobs`;
    
    const response = await fetch(url, {
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
