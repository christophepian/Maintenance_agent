import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Section from "../../components/layout/Section";
import { styles } from "../../styles/managerStyles";
import { formatChf as formatCurrency, formatDate } from "../../lib/format";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ManagerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data
  const [requests, setRequests] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      // Fetch all data in parallel (H5: use view=summary for dashboard KPIs)
      const [reqRes, jobRes, invRes] = await Promise.all([
        fetch("/api/requests?view=summary", { headers: authHeaders() }),
        fetch("/api/jobs?view=summary", { headers: authHeaders() }),
        fetch("/api/invoices?view=summary", { headers: authHeaders() }),
      ]);

      const reqData = await reqRes.json();
      const jobData = await jobRes.json();
      const invData = await invRes.json();

      if (!reqRes.ok) throw new Error(reqData?.error?.message || "Failed to load requests");
      if (!jobRes.ok) throw new Error(jobData?.error?.message || "Failed to load jobs");
      if (!invRes.ok) throw new Error(invData?.error?.message || "Failed to load invoices");

      setRequests(reqData?.data || []);
      setJobs(jobData?.data || []);
      setInvoices(invData?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ─── KPIs ───
  const pendingReviewRequests = useMemo(
    () => requests.filter((r) => r.status === "PENDING_REVIEW"),
    [requests]
  );

  const pendingOwnerApprovalRequests = useMemo(
    () => requests.filter((r) => r.status === "PENDING_OWNER_APPROVAL"),
    [requests]
  );

  const disputedInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === "DISPUTED"),
    [invoices]
  );

  const staleJobs = useMemo(() => {
    const now = Date.now();
    const staleThresholdMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    return jobs.filter((j) => {
      if (j.status !== "IN_PROGRESS") return false;
      const startTime = j.startedAt ? new Date(j.startedAt).getTime() : new Date(j.createdAt).getTime();
      return now - startTime > staleThresholdMs;
    });
  }, [jobs]);

  const openRequestsCount = useMemo(
    () => requests.filter((r) => ["PENDING_REVIEW", "PENDING_OWNER_APPROVAL", "APPROVED", "ASSIGNED"].includes(r.status)).length,
    [requests]
  );

  const openJobsCount = useMemo(
    () => jobs.filter((j) => ["PENDING", "IN_PROGRESS"].includes(j.status)).length,
    [jobs]
  );

  const spendThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return invoices
      .filter((inv) => {
        if (inv.status !== "PAID" || !inv.paidAt) return false;
        const paidDate = new Date(inv.paidAt);
        return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
  }, [invoices]);

  if (loading) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageHeader title="Manager Dashboard" />
          <PageContent>
            <p>Loading dashboard...</p>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Manager Dashboard" />
        <PageContent>
          {/* Quick Links Section */}
          <Section title="Quick Links">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <button className="button-primary" onClick={() => router.push("/manager/requests")}>
                📋 All Requests
              </button>
              <button className="button-primary" onClick={() => router.push("/manager/finance/invoices")}>
                💰 Invoices
              </button>
              <button className="button-primary" onClick={() => router.push("/manager/leases")}>
                📄 Leases
              </button>
              <button className="button-primary" onClick={() => router.push("/admin-inventory")}>
                🏢 Inventory
              </button>
            </div>
          </Section>

          {error && (
            <Panel style={{ backgroundColor: "#fff0f0", borderColor: "#ffb3b3" }}>
              <strong style={styles.errorText}>Error:</strong> {error}
            </Panel>
          )}

          {/* Action Required Section */}
          <Section title="Action Required">
            <div style={styles.gridGap12}>
              <Panel>
                <div style={styles.rowSpaceBetween}>
                  <div>
                    <strong style={styles.headingFlush}>Requests Pending Review</strong>
                    <div style={styles.subtleText}>Manager approval required</div>
                  </div>
                  <div style={{ fontSize: "2em", fontWeight: 700, color: pendingReviewRequests.length > 0 ? "#7a4a00" : "#999" }}>
                    {pendingReviewRequests.length}
                  </div>
                </div>
                {pendingReviewRequests.length > 0 && (
                  <div style={styles.marginTop12}>
                    <button onClick={() => router.push("/manager/requests?filter=PENDING_REVIEW")}>
                      Review Now →
                    </button>
                  </div>
                )}
              </Panel>

              {pendingOwnerApprovalRequests.length > 0 && (
                <Panel>
                  <div style={styles.rowSpaceBetween}>
                    <div>
                      <strong style={styles.headingFlush}>Owner Approval Pending</strong>
                      <div style={styles.subtleText}>High-value requests</div>
                    </div>
                    <div style={{ fontSize: "2em", fontWeight: 700, color: "#7a1f1f" }}>
                      {pendingOwnerApprovalRequests.length}
                    </div>
                  </div>
                </Panel>
              )}

              {disputedInvoices.length > 0 && (
                <Panel>
                  <div style={styles.rowSpaceBetween}>
                    <div>
                      <strong style={styles.headingFlush}>Disputed Invoices</strong>
                      <div style={styles.subtleText}>Require resolution</div>
                    </div>
                    <div style={{ fontSize: "2em", fontWeight: 700, color: "#b30000" }}>
                      {disputedInvoices.length}
                    </div>
                  </div>
                  <div style={styles.marginTop12}>
                    <button onClick={() => router.push("/manager/finance/invoices?status=DISPUTED")}>
                      Resolve Disputes →
                    </button>
                  </div>
                </Panel>
              )}

              {staleJobs.length > 0 && (
                <Panel>
                  <div style={styles.rowSpaceBetween}>
                    <div>
                      <strong style={styles.headingFlush}>Stale Jobs</strong>
                      <div style={styles.subtleText}>In progress &gt; 7 days</div>
                    </div>
                    <div style={{ fontSize: "2em", fontWeight: 700, color: "#7a4a00" }}>
                      {staleJobs.length}
                    </div>
                  </div>
                </Panel>
              )}

              {pendingReviewRequests.length === 0 && 
               pendingOwnerApprovalRequests.length === 0 && 
               disputedInvoices.length === 0 && 
               staleJobs.length === 0 && (
                <Panel>
                  <p style={{ ...styles.okText, ...styles.headingFlush }}>✓ No items require immediate action</p>
                </Panel>
              )}
            </div>
          </Section>

          {/* Operational KPIs Section */}
          <Section title="Operational Health">
            <div style={styles.gridGap12}>
              <Panel>
                <div style={styles.rowSpaceBetween}>
                  <div>
                    <strong style={styles.headingFlush}>Open Requests</strong>
                    <div style={styles.subtleText}>Pending, approved, assigned</div>
                  </div>
                  <div style={{ fontSize: "2em", fontWeight: 700, color: openRequestsCount > 20 ? "#7a4a00" : "#0b3a75" }}>
                    {openRequestsCount}
                  </div>
                </div>
              </Panel>

              <Panel>
                <div style={styles.rowSpaceBetween}>
                  <div>
                    <strong style={styles.headingFlush}>Open Jobs</strong>
                    <div style={styles.subtleText}>Pending + in progress</div>
                  </div>
                  <div style={{ fontSize: "2em", fontWeight: 700, color: openJobsCount > 15 ? "#7a4a00" : "#0b3a75" }}>
                    {openJobsCount}
                  </div>
                </div>
              </Panel>

              <Panel>
                <div style={styles.rowSpaceBetween}>
                  <div>
                    <strong style={styles.headingFlush}>Spend This Month</strong>
                    <div style={styles.subtleText}>Paid invoices</div>
                  </div>
                  <div style={{ fontSize: "1.6em", fontWeight: 700, color: "#116b2b" }}>
                    {formatCurrency(spendThisMonth)}
                  </div>
                </div>
              </Panel>
            </div>
          </Section>

        </PageContent>
      </PageShell>
    </AppShell>
  );
}
