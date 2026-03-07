import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Section from "../../components/layout/Section";
import ContractorPicker from "../../components/ContractorPicker";
import { formatChf as formatCurrency, formatDate } from "../../lib/format";
import { authHeaders } from "../../lib/api";
export default function ContractorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      // Fetch contractor-relevant data (H5: use view=summary; prefer contractor-scoped endpoints)
      const contractorId = typeof window !== "undefined" ? localStorage.getItem("contractorId") : null;
      const jobUrl = contractorId
        ? `/api/contractor/jobs?contractorId=${contractorId}&view=summary`
        : "/api/jobs?view=summary";
      const invUrl = contractorId
        ? `/api/contractor/invoices?contractorId=${contractorId}&view=summary`
        : "/api/invoices?view=summary";
      const [jobRes, invRes] = await Promise.all([
        fetch(jobUrl, { headers: authHeaders() }),
        fetch(invUrl, { headers: authHeaders() }),
      ]);

      const jobData = await jobRes.json();
      const invData = await invRes.json();

      if (!jobRes.ok) throw new Error(jobData?.error?.message || "Failed to load jobs");
      if (!invRes.ok) throw new Error(invData?.error?.message || "Failed to load invoices");

      setJobs(jobData?.data || []);
      setInvoices(invData?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ─── KPIs ───
  const pendingJobs = useMemo(
    () => jobs.filter((j) => j.status === "PENDING"),
    [jobs]
  );

  const staleInProgressJobs = useMemo(() => {
    const now = Date.now();
    const staleThresholdMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    return jobs.filter((j) => {
      if (j.status !== "IN_PROGRESS") return false;
      const startTime = j.startedAt ? new Date(j.startedAt).getTime() : new Date(j.createdAt).getTime();
      return now - startTime > staleThresholdMs;
    });
  }, [jobs]);

  const completedNotInvoiced = useMemo(() => {
    // Jobs completed but without invoices
    const jobsWithInvoices = new Set(invoices.map((inv) => inv.jobId));
    return jobs.filter((j) => j.status === "COMPLETED" && !jobsWithInvoices.has(j.id));
  }, [jobs, invoices]);

  const openJobsCount = useMemo(
    () => jobs.filter((j) => ["PENDING", "IN_PROGRESS"].includes(j.status)).length,
    [jobs]
  );

  const completedThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return jobs.filter((j) => {
      if (j.status !== "COMPLETED" || !j.completedAt) return false;
      const completedDate = new Date(j.completedAt);
      return completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear;
    }).length;
  }, [jobs]);

  const invoicedThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return invoices
      .filter((inv) => {
        if (!inv.createdAt) return false;
        const createdDate = new Date(inv.createdAt);
        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
  }, [invoices]);

  if (loading) {
    return (
      <AppShell role="CONTRACTOR">
        <PageShell>
          <PageHeader title="Contractor Dashboard" />
          <PageContent>
            <p>Loading dashboard...</p>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="CONTRACTOR">
      <PageShell>
        <PageHeader title="Contractor Dashboard" />
        <PageContent>
          <ContractorPicker onSelect={() => loadDashboardData()} />

          {/* Quick Links Section */}
          <Section title="Quick Links">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <button className="button-primary" onClick={() => router.push("/contractor/jobs")}>
                🔧 All Jobs
              </button>
                <button className="button-primary" onClick={() => router.push("/contractor/invoices")}>
                💰 Invoices
              </button>
                <button className="button-primary" onClick={() => router.push("/contractor/status-updates")}>
                📝 Status Updates
              </button>
            </div>
          </Section>

          {error && (
            <Panel style={{ backgroundColor: "#fff0f0", borderColor: "#ffb3b3" }}>
              <strong style={{ color: "crimson" }}>Error:</strong> {error}
            </Panel>
          )}

          {/* Action Required Section */}
          <Section title="Today / Action Required">
            <div style={{ display: "grid", gap: 12 }}>
              <Panel>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <strong style={{ margin: 0 }}>Pending Jobs</strong>
                    <div style={{ color: "#444", fontSize: "0.9em" }}>Need acceptance/start</div>
                  </div>
                  <div style={{ fontSize: "2em", fontWeight: 700, color: pendingJobs.length > 0 ? "#7a4a00" : "#999" }}>
                    {pendingJobs.length}
                  </div>
                </div>
                {pendingJobs.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <button onClick={() => router.push("/contractor/jobs?status=PENDING")}>
                      View Pending Jobs →
                    </button>
                  </div>
                )}
              </Panel>

              {staleInProgressJobs.length > 0 && (
                <Panel>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <strong style={{ margin: 0 }}>Stale In-Progress Jobs</strong>
                      <div style={{ color: "#444", fontSize: "0.9em" }}>Active &gt; 7 days</div>
                    </div>
                    <div style={{ fontSize: "2em", fontWeight: 700, color: "#7a4a00" }}>
                      {staleInProgressJobs.length}
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button onClick={() => router.push("/contractor/jobs?status=IN_PROGRESS")}>
                      Review Jobs →
                    </button>
                  </div>
                </Panel>
              )}

              {completedNotInvoiced.length > 0 && (
                <Panel>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <strong style={{ margin: 0 }}>Completed - Not Invoiced</strong>
                      <div style={{ color: "#444", fontSize: "0.9em" }}>Ready for billing</div>
                    </div>
                    <div style={{ fontSize: "2em", fontWeight: 700, color: "#0b3a75" }}>
                      {completedNotInvoiced.length}
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button onClick={() => router.push("/contractor/jobs?status=COMPLETED")}>
                      Create Invoices →
                    </button>
                  </div>
                </Panel>
              )}

              {pendingJobs.length === 0 && 
               staleInProgressJobs.length === 0 && 
               completedNotInvoiced.length === 0 && (
                <Panel>
                  <p style={{ color: "#116b2b", margin: 0 }}>✓ No items require immediate action</p>
                </Panel>
              )}
            </div>
          </Section>

          {/* Pipeline KPIs Section */}
          <Section title="Pipeline Overview">
            <div style={{ display: "grid", gap: 12 }}>
              <Panel>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <strong style={{ margin: 0 }}>Open Jobs</strong>
                    <div style={{ color: "#444", fontSize: "0.9em" }}>Pending + in progress</div>
                  </div>
                  <div style={{ fontSize: "2em", fontWeight: 700, color: openJobsCount > 0 ? "#0b3a75" : "#999" }}>
                    {openJobsCount}
                  </div>
                </div>
              </Panel>

              <Panel>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <strong style={{ margin: 0 }}>Completed This Month</strong>
                    <div style={{ color: "#444", fontSize: "0.9em" }}>Jobs finished</div>
                  </div>
                  <div style={{ fontSize: "2em", fontWeight: 700, color: "#116b2b" }}>
                    {completedThisMonth}
                  </div>
                </div>
              </Panel>

              <Panel>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <strong style={{ margin: 0 }}>Invoiced This Month</strong>
                    <div style={{ color: "#444", fontSize: "0.9em" }}>Total billed</div>
                  </div>
                  <div style={{ fontSize: "1.6em", fontWeight: 700, color: "#116b2b" }}>
                    {formatCurrency(invoicedThisMonth)}
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
