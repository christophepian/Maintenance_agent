import { useState, useEffect } from 'react';
import AppShell from '../components/AppShell';

export default function TestRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/requests?limit=100');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setRequests(data.data || []);
      console.log(`Fetched ${data.data ? data.data.length : 0} requests`);
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    }
    setLoading(false);
  };

  return (
    <AppShell role="OWNER">
      <div style={{ maxWidth: "1200px" }}>
        <h1>Test Requests</h1>
        
        {loading && <p>Loading...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        
        <p><strong>Total requests: {requests.length}</strong></p>
        
        <button onClick={fetchRequests} style={{ padding: '10px 20px', marginBottom: '20px' }}>
          Refresh Requests
        </button>

        {requests.length === 0 ? (
          <p style={{ color: 'gray' }}>No requests found</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Description</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Category</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Estimated Cost</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
                    {req.id.slice(0, 8)}...
                  </td>
                  <td style={{ padding: '10px' }}>{req.description}</td>
                  <td style={{ padding: '10px' }}>{req.category || 'N/A'}</td>
                  <td style={{ padding: '10px' }}>
                    {req.estimatedCost ? `CHF ${req.estimatedCost}` : 'N/A'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: req.status === 'APPROVED' ? '#d4edda' : '#fff3cd',
                      color: req.status === 'APPROVED' ? '#155724' : '#856404'
                    }}>
                      {req.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
