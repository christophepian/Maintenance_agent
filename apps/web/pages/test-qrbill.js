import { useState, useEffect } from 'react';

export default function TestQRBill() {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [qrBillData, setQRBillData] = useState(null);
  const [qrCodeUrl, setQRCodeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch invoices on load
  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/invoices?limit=20&offset=0');
      const json = await res.json();
      const invoiceList = Array.isArray(json.data) ? json.data : (json.data?.invoices || []);
      setInvoices(invoiceList);
      if (invoiceList.length > 0) {
        setSelectedInvoice(invoiceList[0]);
      }
    } catch (e) {
      setError(`Failed to fetch invoices: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchQRBillData = async (invoiceId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/qr-bill`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setQRBillData(json.data);
      setQRCodeUrl(`/api/invoices/${invoiceId}/qr-code.png`);
    } catch (e) {
      setError(`Failed to fetch QR-bill: ${e.message}`);
      setQRBillData(null);
      setQRCodeUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    fetchQRBillData(invoice.id);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui' }}>
      <h1>Slice 8.4 - QR-Bill Testing</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Test the QR-bill generation for invoices. Select an invoice to view its QR-bill data and QR code.
      </p>

      {error && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          backgroundColor: '#fee',
          border: '1px solid #f99',
          borderRadius: '4px',
          color: '#c33'
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
        {/* Left: Invoice List */}
        <div>
          <h2>Invoices</h2>
          <button
            onClick={fetchInvoices}
            disabled={loading}
            style={{
              padding: '10px 15px',
              marginBottom: '15px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>

          <div style={{ maxHeight: '600px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
            {invoices.length === 0 ? (
              <div style={{ padding: '20px', color: '#999' }}>No invoices found</div>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => handleSelectInvoice(inv)}
                  style={{
                    padding: '15px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    backgroundColor: selectedInvoice?.id === inv.id ? '#e7f3ff' : 'white',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                    {inv.invoiceNumber || '(draft)'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    CHF {(inv.totalAmount / 100).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
                    {inv.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: QR-Bill Details */}
        <div>
          <h2>QR-Bill Details</h2>
          {selectedInvoice ? (
            <div>
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Invoice ID:</label>
                  <code style={{ padding: '8px', backgroundColor: '#fff', borderRadius: '4px', display: 'block', wordBreak: 'break-all', fontSize: '12px' }}>
                    {selectedInvoice.id}
                  </code>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Invoice Number:</label>
                  <div>{selectedInvoice.invoiceNumber || '(not yet issued)'}</div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Amount:</label>
                  <div>CHF {(selectedInvoice.totalAmount / 100).toFixed(2)}</div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Status:</label>
                  <div>{selectedInvoice.status}</div>
                </div>

                <button
                  onClick={() => fetchQRBillData(selectedInvoice.id)}
                  disabled={loading}
                  style={{
                    padding: '10px 15px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? 'Generating QR...' : 'Generate QR-Bill'}
                </button>
              </div>

              {qrBillData && (
                <>
                  <h3>QR-Bill Payload</h3>
                  <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Amount:</strong> {qrBillData.amount} CHF
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>IBAN:</strong> {qrBillData.creditorIban}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Reference:</strong> {qrBillData.reference}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Creditor:</strong> {qrBillData.creditorName}
                    </div>
                    <hr style={{ margin: '15px 0' }} />
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#666' }}>
                      {qrBillData.qrPayload}
                    </div>
                  </div>

                  {qrCodeUrl && (
                    <>
                      <h3>QR Code (PNG)</h3>
                      <div style={{
                        padding: '20px',
                        backgroundColor: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}>
                        <img
                          src={qrCodeUrl}
                          alt="QR Code"
                          style={{
                            maxWidth: '300px',
                            maxHeight: '300px',
                            margin: '0 auto'
                          }}
                        />
                        <div style={{ marginTop: '15px' }}>
                          <a
                            href={qrCodeUrl}
                            download={`invoice-${selectedInvoice.invoiceNumber || 'draft'}.png`}
                            style={{
                              display: 'inline-block',
                              padding: '10px 15px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              textDecoration: 'none',
                              borderRadius: '4px'
                            }}
                          >
                            Download QR Code
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={{ padding: '20px', color: '#999' }}>Select an invoice to view QR-bill details</div>
          )}
        </div>
      </div>

      <hr style={{ margin: '40px 0' }} />

      <h2>API Endpoints</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '10px', textAlign: 'left' }}>Endpoint</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Method</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Returns</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '10px' }}><code>/api/invoices/:id/qr-bill</code></td>
            <td style={{ padding: '10px' }}>GET</td>
            <td style={{ padding: '10px' }}>JSON with QR payload, SVG, amounts, IBAN, reference</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '10px' }}><code>/api/invoices/:id/qr-code.png</code></td>
            <td style={{ padding: '10px' }}>GET</td>
            <td style={{ padding: '10px' }}>PNG image (QR code)</td>
          </tr>
        </tbody>
      </table>

      <h2>Testing Steps</h2>
      <ol>
        <li>Make sure you have invoices in the system (create one if needed via /test-jobs.js)</li>
        <li>Click "Refresh" to load invoices</li>
        <li>Select an invoice from the list</li>
        <li>Click "Generate QR-Bill" to fetch QR-bill data</li>
        <li>View the QR payload and scan the QR code with a Swiss banking app</li>
        <li>Download the QR code PNG for use in documents</li>
      </ol>
    </div>
  );
}
