export default async function handler(req, res) {
  const { API_BASE_URL = 'http://127.0.0.1:3001' } = process.env;
  const { id, action } = req.query;

  try {
    const url = action 
      ? `${API_BASE_URL}/invoices/${id}/${action}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`
      : `${API_BASE_URL}/invoices${id ? '/' + id : ''}`;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    // Handle binary responses (e.g., PNG images, PDF files)
    if (action === 'qr-code.png' || action === 'pdf') {
      const buffer = await response.arrayBuffer();
      const contentType = action === 'pdf' ? 'application/pdf' : 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.byteLength);
      
      // For PDFs, preserve the disposition header from backend
      if (action === 'pdf') {
        const disposition = response.headers.get('content-disposition');
        if (disposition) {
          res.setHeader('Content-Disposition', disposition);
        }
      }
      
      res.status(response.status);
      res.end(Buffer.from(buffer));
    } else {
      // Handle JSON responses
      const data = await response.json();
      res.status(response.status).json(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
