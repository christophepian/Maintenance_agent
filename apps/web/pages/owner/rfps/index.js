import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField, DateField } from "../../../components/ui/FilterPanel";
import { ownerAuthHeaders } from "../../../lib/api";
import Badge from "../../../components/ui/Badge";
import { urgencyVariant, rfpVariant } from "../../../lib/statusVariants";
import { formatDate } from "../../../lib/format";

function UrgencyPill({ urgency }) {
  if (!urgency) return null;
  return (
    <Badge variant={urgencyVariant(urgency)} size="sm">
      {urgency.charAt(0) + urgency.slice(1).toLowerCase()}
    </Badge>
  );
}

function StatusPill({ status }) {
  return (
    <Badge variant={rfpVariant(status)} size="sm">
      {status?.replace(/_/g, " ") || "—"}
    </Badge>
  );
}

export default function OwnerRfpsPage() {
  const [rfps, setRfps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/rfps", { headers: ownerAuthHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || "Failed to load RFPs");
        setRfps(data?.data || []);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Derived filter options
  const buildings = [...new Set(rfps.map((r) => r.building?.name).filter(Boolean))].sort();

  const filtered = rfps.filter((r) => {
    if (dateFrom && r.createdAt < dateFrom) return false;
    if (dateTo && r.createdAt > dateTo + "T23:59:59") return false;
    if (buildingFilter && r.building?.name !== buildingFilter) return false;
    if (urgencyFilter && r.request?.urgency !== urgencyFilter) return false;
    return true;
  });

  const pendingApproval = filtered.filter((r) => r.status === "PENDING_OWNER_APPROVAL");
  const otherRfps = filtered.filter((r) => r.status !== "PENDING_OWNER_APPROVAL");

  const activeCount = [dateFrom, dateTo, buildingFilter, urgencyFilter].filter(Boolean).length;
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="RFPs"
          subtitle="Request for Proposals overview"
        />
        <PageContent>
          <ErrorBanner error={error} className="text-sm" />

          <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
          {filterOpen && (
            <FilterPanelBody>
              <FilterSection title="Date range" first>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DateField label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <DateField label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </FilterSection>
              <FilterSection title="Scope">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectField label="Building" value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
                    <option value="">All buildings</option>
                    {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSection title="Priority">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectField label="Urgency" value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
                    <option value="">All levels</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="EMERGENCY">Emergency</option>
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSectionClear hasFilter={activeCount > 0} onClear={() => { setDateFrom(""); setDateTo(""); setBuildingFilter(""); setUrgencyFilter(""); }} />
            </FilterPanelBody>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              {pendingApproval.length > 0 && (
                <Panel title={`🔔 Awaiting Your Approval (${pendingApproval.length})`} bodyClassName="p-0">
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>RFP</th>
                        <th>Category</th>
                        <th>Building</th>
                        <th>Urgency</th>
                        <th>Quotes</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingApproval.map((r) => (
                        <tr key={r.id}>
                          <td className="font-mono text-xs">{r.id?.slice(0, 8)}</td>
                          <td>{r.category || "—"}</td>
                          <td>{r.building?.name || "—"}</td>
                          <td><UrgencyPill urgency={r.request?.urgency} /></td>
                          <td>{r.quoteCount ?? r.quotes?.length ?? 0}</td>
                          <td><StatusPill status={r.status} /></td>
                          <td>{formatDate(r.createdAt)}</td>
                          <td>
                            <Link
                              href={`/owner/rfps/${r.id}`}
                              className="cell-link text-sm font-medium"
                            >
                              Review →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}

              <Panel title={`All RFPs (${filtered.length})`} bodyClassName="p-0">
                {filtered.length > 0 ? (
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>RFP</th>
                        <th>Category</th>
                        <th>Building</th>
                        <th>Urgency</th>
                        <th>Quotes</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id}>
                          <td className="font-mono text-xs">{r.id?.slice(0, 8)}</td>
                          <td>{r.category || "—"}</td>
                          <td>{r.building?.name || "—"}</td>
                          <td><UrgencyPill urgency={r.request?.urgency} /></td>
                          <td>{r.quoteCount ?? r.quotes?.length ?? 0}</td>
                          <td><StatusPill status={r.status} /></td>
                          <td>{formatDate(r.createdAt)}</td>
                          <td>
                            <Link
                              href={`/owner/rfps/${r.id}`}
                              className="cell-link text-sm font-medium"
                            >
                              View →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    {rfps.length === 0 ? "No RFPs found." : "No results match the current filters."}
                  </p>
                )}
              </Panel>
            </>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
