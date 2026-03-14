import { useEffect, useState, useCallback } from "react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatCurrency(amount) {
  if (typeof amount !== "number") return "—";
  const str = amount.toFixed(2);
  const [intPart, decPart] = str.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${formatted}.${decPart}`;
}

export default function ManagerPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState([]);
  const [buildings, setBuildings] = useState([]);

  // Filters
  const [buildingId, setBuildingId] = useState("");
  const [paidAfter, setPaidAfter] = useState("");
  const [paidBefore, setPaidBefore] = useState("");

  // Load buildings for dropdown
  useEffect(() => {
    fetch("/api/buildings", { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setBuildings(data?.data || []))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: "PAID", view: "summary" });
      if (buildingId) params.set("buildingId", buildingId);
      if (paidAfter) params.set("paidAfter", paidAfter);
      if (paidBefore) params.set("paidBefore", paidBefore);

      const res = await fetch(`/api/invoices?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load payments");
      setPayments(data?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [buildingId, paidAfter, paidBefore]);

  useEffect(() => { loadData(); }, [loadData]);

  function clearFilters() {
    setBuildingId("");
    setPaidAfter("");
    setPaidBefore("");
  }

  const hasFilters = buildingId || paidAfter || paidBefore;

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Payments" />
        <PageContent>
          {error && (
            <Panel style={{ backgroundColor: "#fff0f0", borderColor: "#ffb3b3" }}>
              <strong className="text-err-text">Error:</strong> {error}
              <button onClick={() => setError("")} style={{ marginLeft: 12, fontSize: "0.85em" }}>Dismiss</button>
            </Panel>
          )}

          {/* Filters */}
          <Panel>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8em", fontWeight: 600, marginBottom: 4 }}>Building</label>
                <select
                  value={buildingId}
                  onChange={(e) => setBuildingId(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.9em", minWidth: 180 }}
                >
                  <option value="">All buildings</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name || b.address}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8em", fontWeight: 600, marginBottom: 4 }}>Paid after</label>
                <input
                  type="date"
                  value={paidAfter}
                  onChange={(e) => setPaidAfter(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.9em" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8em", fontWeight: 600, marginBottom: 4 }}>Paid before</label>
                <input
                  type="date"
                  value={paidBefore}
                  onChange={(e) => setPaidBefore(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.9em" }}
                />
              </div>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  style={{
                    padding: "6px 14px", borderRadius: 4, fontSize: "0.85em",
                    border: "1px solid #ccc", backgroundColor: "#f5f5f5", cursor: "pointer",
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </Panel>

          {loading ? (
            <Panel><p className="m-0">Loading payments...</p></Panel>
          ) : payments.length === 0 ? (
            <Panel>
              <p className="m-0">No payments found for the selected filters.</p>
            </Panel>
          ) : (
            <Panel bodyClassName="p-0">
            <table className="inline-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Description</th>
                    <th>Amount (CHF)</th>
                    <th>Paid on</th>
                    <th>Payment reference</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.invoiceNumber || p.id.slice(0, 8)}</td>
                      <td>{p.description || "—"}</td>
                      <td className="cell-bold">{formatCurrency(p.totalAmount)}</td>
                      <td>{formatDate(p.paidAt)}</td>
                      <td>{p.paymentReference || "—"}</td>
                      <td>
                        <a
                          href="/manager/finance/invoices"
                          style={{
                            padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                            backgroundColor: "#e3f2fd", color: "#0b3a75", border: "1px solid #90caf9",
                            textDecoration: "none", display: "inline-block",
                          }}
                        >
                          View Invoice
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
