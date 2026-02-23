export default async function handler(req, res) {
  const { API_BASE_URL = 'http://127.0.0.1:3001' } = process.env;
  const { id } = req.query;

  try {
    const url = `${API_BASE_URL}/requests/${id}/owner-approve`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body || {}),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
