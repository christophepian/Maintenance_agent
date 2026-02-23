import { useState } from "react";
import AppShell from "../components/AppShell";

export default function TestPDF() {
  const [invoiceId, setInvoiceId] = useState("06152ea0-1f1b-4e60-acbd-687d63beb0b6");
  const [testResult, setTestResult] = useState("");
  const [loading, setLoading] = useState(false);

  const runTest = async (testName, testFn) => {
    setLoading(true);
    setTestResult(`Running ${testName}...`);
    try {
      const result = await testFn();
      setTestResult(`✅ ${testName}\n${JSON.stringify(result, null, 2)}`);
    } catch (err) {
      setTestResult(`❌ ${testName}\n${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const tests = [
    {
      name: "Get Invoice Data",
      async fn() {
        const res = await fetch(`/api/invoices/${invoiceId}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      },
    },
    {
      name: "Get QR Bill Data",
      async fn() {
        const res = await fetch(`/api/invoices/${invoiceId}/qr-bill`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      },
    },
    {
      name: "Download Invoice PDF (with QR Bill)",
      async fn() {
        const res = await fetch(`/api/invoices/${invoiceId}/pdf?includeQRBill=true`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return { size: blob.size, type: blob.type };
      },
    },
    {
      name: "Download Invoice PDF (without QR Bill)",
      async fn() {
        const res = await fetch(`/api/invoices/${invoiceId}/pdf?includeQRBill=false`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return { size: blob.size, type: blob.type };
      },
    },
  ];

  const triggerDownload = async (withQRBill = true) => {
    try {
      const url = `/api/invoices/${invoiceId}/pdf?includeQRBill=${withQRBill}`;
      console.log(`[Download] Fetching PDF from ${url}`);
      
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
      });
      
      console.log(`[Download] Response status: ${res.status}, type: ${res.headers.get('content-type')}`);
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      
      const blob = await res.blob();
      console.log(`[Download] Got blob: ${blob.size} bytes, type: ${blob.type}`);
      
      if (blob.size === 0) {
        throw new Error("Received empty blob");
      }
      
      const url_obj = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url_obj;
      a.download = `invoice-${new Date().toISOString().split("T")[0]}.pdf`;
      console.log(`[Download] Triggering download: ${a.download}`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url_obj);
      setTestResult(`✅ Downloaded PDF (${blob.size} bytes)`);
    } catch (err) {
      console.error(`[Download] Error:`, err);
      setTestResult(`❌ Download failed: ${err.message}`);
    }
  };

  return (
    <AppShell>
      <div style={{ padding: "20px", maxWidth: "800px" }}>
        <h1>Invoice PDF Testing</h1>

        <div style={{ marginBottom: "20px", padding: "10px", backgroundColor: "#f0f0f0", borderRadius: "4px" }}>
          <label style={{ display: "block", marginBottom: "8px" }}>
            Invoice ID:
          </label>
          <input
            type="text"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            style={{ width: "100%", padding: "8px", fontFamily: "monospace" }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h3>API Tests</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {tests.map((test) => (
              <button
                key={test.name}
                onClick={() => runTest(test.name, test.fn)}
                disabled={loading}
                style={{
                  padding: "10px",
                  backgroundColor: "#0070f3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                {test.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h3>Direct Download</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <button
              onClick={() => triggerDownload(true)}
              disabled={loading}
              style={{
                padding: "10px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Download with QR Bill
            </button>
            <button
              onClick={() => triggerDownload(false)}
              disabled={loading}
              style={{
                padding: "10px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Download without QR Bill
            </button>
          </div>
        </div>

        <div style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: "#f9f9f9",
          borderRadius: "4px",
          border: "1px solid #ddd",
          fontFamily: "monospace",
          fontSize: "12px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: "400px",
          overflowY: "auto",
        }}>
          {testResult || "Results will appear here..."}
        </div>
      </div>
    </AppShell>
  );
}
