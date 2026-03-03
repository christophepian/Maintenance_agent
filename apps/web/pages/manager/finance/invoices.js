import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { styles } from "../../../styles/managerStyles";

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "ISSUED", label: "Issued" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "DISPUTED", label: "Disputed" },
];

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatCurrency(cents) {
  if (typeof cents !== "number") return "—";
  const value = cents / 100;
  const str = value.toFixed(2);
  const [intPart, decPart] = str.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${formatted}.${decPart}`;
}

function formatCurrencyWhole(amount) {
  if (typeof amount !== "number") return "—";
  const str = amount.toFixed(0);
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${formatted}`;
}

const statusColors = {
  DRAFT: { bg: "#f5f5f5", color: "#666", border: "#ccc" },
  ISSUED: { bg: "#e3f2fd", color: "#0b3a75", border: "#90caf9" },
  APPROVED: { bg: "#e8f5e9", color: "#1b5e20", border: "#a5d6a7" },
  PAID: { bg: "#e8f5e9", color: "#116b2b", border: "#66bb6a" },
  DISPUTED: { bg: "#fce4ec", color: "#b30000", border: "#ef9a9a" },
};

function StatusBadge({ status }) {
  const c = statusColors[status] || { bg: "#f5f5f5", color: "#666", border: "#ccc" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 12,
      fontSize: "0.8em", fontWeight: 600,
      backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {status}
    </span>
  );
}

export default function ManagerInvoicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (router.query.status) setActiveTab(router.query.status);
  }, [router.query.status]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/invoices?view=summary", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load invoices");
      setInvoices(data?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredInvoices = useMemo(() => {
    if (activeTab === "ALL") return invoices;
    return invoices.filter((inv) => inv.status === activeTab);
  }, [invoices, activeTab]);

  // ─── Actions ───
  async function invoiceAction(id, action) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/invoices/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || `Failed to ${action}`);
      }
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setActionLoading(null);
    }
  }

  function getAmount(inv) {
    // Support both totalAmountCents (summary) and totalAmount/amount (full)
    if (typeof inv.totalAmountCents === "number") return formatCurrency(inv.totalAmountCents);
    if (typeof inv.totalAmount === "number") return formatCurrencyWhole(inv.totalAmount);
    if (typeof inv.amount === "number") return formatCurrencyWhole(inv.amount);
    return "—";
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Invoices" />
        <PageContent>
          {error && (
            <Panel style={{ backgroundColor: "#fff0f0", borderColor: "#ffb3b3" }}>
              <strong style={styles.errorText}>Error:</strong> {error}
              <button onClick={() => setError("")} style={{ marginLeft: 12, fontSize: "0.85em" }}>Dismiss</button>
            </Panel>
          )}

          {/* Status Tabs */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
            {STATUS_TABS.map((tab) => {
              const count = tab.key === "ALL"
                ? invoices.length
                : invoices.filter((inv) => inv.status === tab.key).length;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "6px 14px", borderRadius: 6, fontSize: "0.85em", fontWeight: active ? 700 : 400,
                    border: active ? "2px solid #0b3a75" : "1px solid #ccc",
                    backgroundColor: active ? "#e3f2fd" : "#fff",
                    color: active ? "#0b3a75" : "#333", cursor: "pointer",
                  }}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <p>Loading invoices...</p>
          ) : filteredInvoices.length === 0 ? (
            <Panel>
              <p style={styles.headingFlush}>No invoices match this filter.</p>
            </Panel>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                    <th style={{ padding: "8px 6px" }}>Status</th>
                    <th style={{ padding: "8px 6px" }}>Invoice #</th>
                    <th style={{ padding: "8px 6px" }}>Amount</th>
                    <th style={{ padding: "8px 6px" }}>Issuer</th>
                    <th style={{ padding: "8px 6px" }}>Created</th>
                    <th style={{ padding: "8px 6px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "8px 6px" }}><StatusBadge status={inv.status} /></td>
                      <td style={{ padding: "8px 6px" }}>{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                      <td style={{ padding: "8px 6px", fontWeight: 600 }}>{getAmount(inv)}</td>
                      <td style={{ padding: "8px 6px" }}>{inv.issuerName || "—"}</td>
                      <td style={{ padding: "8px 6px" }}>{formatDate(inv.createdAt)}</td>
                      <td style={{ padding: "8px 6px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {/* Approve — for ISSUED invoices */}
                          {inv.status === "ISSUED" && (
                            <button
                              onClick={() => invoiceAction(inv.id, "approve")}
                              disabled={actionLoading === inv.id}
                              style={{
                                padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                                backgroundColor: "#1b5e20", color: "#fff", border: "none", cursor: "pointer",
                              }}
                            >
                              {actionLoading === inv.id ? "…" : "Approve"}
                            </button>
                          )}

                          {/* Mark Paid — for APPROVED invoices */}
                          {inv.status === "APPROVED" && (
                            <button
                              onClick={() => invoiceAction(inv.id, "mark-paid")}
                              disabled={actionLoading === inv.id}
                              style={{
                                padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                                backgroundColor: "#116b2b", color: "#fff", border: "none", cursor: "pointer",
                              }}
                            >
                              {actionLoading === inv.id ? "…" : "Mark Paid"}
                            </button>
                          )}

                          {/* Dispute — for ISSUED or APPROVED */}
                          {["ISSUED", "APPROVED"].includes(inv.status) && (
                            <button
                              onClick={() => invoiceAction(inv.id, "dispute")}
                              disabled={actionLoading === inv.id}
                              style={{
                                padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                                backgroundColor: "#b71c1c", color: "#fff", border: "none", cursor: "pointer",
                              }}
                            >
                              {actionLoading === inv.id ? "…" : "Dispute"}
                            </button>
                          )}

                          {/* PDF link */}
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                              backgroundColor: "#eee", color: "#333", border: "1px solid #ccc",
                              textDecoration: "none", display: "inline-block",
                            }}
                          >
                            PDF
                          </a>

                          {/* QR Code link */}
                          <a
                            href={`/api/invoices/${inv.id}/qr-code.png`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                              backgroundColor: "#eee", color: "#333", border: "1px solid #ccc",
                              textDecoration: "none", display: "inline-block",
                            }}
                          >
                            QR
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
