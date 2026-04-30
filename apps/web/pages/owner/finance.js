import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Section from "../../components/layout/Section";
import ErrorBanner from "../../components/ui/ErrorBanner";
import ConfigurableTable from "../../components/ConfigurableTable";
import Badge from "../../components/ui/Badge";
import KpiInlineGrid from "../../components/ui/KpiInlineGrid";
import CashflowPlansList from "../../components/CashflowPlansList";
import OwnerPicker from "../../components/OwnerPicker";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField, DateField } from "../../components/ui/FilterPanel";
import { invoiceVariant } from "../../lib/statusVariants";
import { formatChf, formatChfCents, formatDate, formatPercent } from "../../lib/format";
import { ownerAuthHeaders } from "../../lib/api";
import { useTableSort, useLocalSort, clientSort } from "../../lib/tableUtils";
import { cn } from "../../lib/utils";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const FINANCE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "invoices", label: "Invoices" },
  { key: "planning", label: "Planning" },
];

const STATUS_TABS = [
  { key: "ALL",      label: "All" },
  { key: "ISSUED",   label: "Issued" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID",     label: "Paid" },
  { key: "DISPUTED", label: "Disputed" },
];

const DIRECTION_TABS = [
  { key: "incoming", label: "Incoming", icon: "📥" },
  { key: "outgoing", label: "Outgoing", icon: "📤" },
];

const INGESTION_LABEL = {
  PENDING_REVIEW: "Needs review",
  AUTO_CONFIRMED: "Auto-confirmed",
  CONFIRMED:      "Confirmed",
  REJECTED:       "Rejected",
};

const SOURCE_LABEL = {
  BROWSER_UPLOAD: { text: "Upload", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  EMAIL_PDF:      { text: "Email",  cls: "bg-violet-50 text-violet-700 border-violet-200" },
  MOBILE_CAPTURE: { text: "Mobile", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  MANUAL:         { text: "Manual", cls: "bg-slate-50 text-slate-600 border-slate-200" },
};

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function defaultRange() {
  const now = new Date();
  return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) };
}

function getInvoiceTotal(inv) {
  if (typeof inv.totalAmount === "number") return inv.totalAmount;
  if (typeof inv.amount === "number") return inv.amount;
  return 0;
}

const SORT_FIELDS = ["status", "invoiceNumber", "amount", "createdAt"];

function fieldExtractor(inv, field) {
  switch (field) {
    case "status":        return inv.status ?? "";
    case "invoiceNumber": return inv.invoiceNumber ?? "";
    case "amount":        return getInvoiceTotal(inv);
    case "createdAt":     return inv.createdAt || "";
    default:              return "";
  }
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

function SummaryCard({ label, value, sub, accent }) {
  const accentClass =
    accent === "green" ? "text-success-text" :
    accent === "red"   ? "text-destructive-text" :
    accent === "amber" ? "text-amber-700" :
    "text-slate-900";
  return (
    <div className="card mb-0 flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={cn("text-xl font-bold", accentClass)}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

const HEALTH_DOT_CLASS = { green: "bg-green-600", amber: "bg-amber-600", red: "bg-red-600" };
function HealthDot({ health }) {
  return (
    <span
      title={health}
      className={cn("inline-block w-2.5 h-2.5 rounded-full shrink-0", HEALTH_DOT_CLASS[health] || "bg-slate-400")}
    />
  );
}

function IngestionBadge({ ingestionStatus }) {
  if (!ingestionStatus) return null;
  return <Badge variant="neutral" size="sm" className="ml-1.5">{INGESTION_LABEL[ingestionStatus] || ingestionStatus}</Badge>;
}

function SourceChannelIcon({ channel }) {
  if (!channel || !SOURCE_LABEL[channel]) return null;
  const { text, cls } = SOURCE_LABEL[channel];
  return <span className={"inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ml-1 " + cls}>{text}</span>;
}

function ActionDropdown({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);
  if (!actions.length) return null;
  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        aria-label="Invoice actions"
      >
        Actions ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black/5">
          <div className="py-1">
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                disabled={a.disabled}
                onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick(); }}
                className={"w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition disabled:opacity-40 " + (a.className || "text-slate-700")}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Overview Tab
   ═══════════════════════════════════════════════════════════════ */

function OverviewTab() {
  const [range, setRange] = useState(defaultRange);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buildingsExpanded, setBuildingsExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/financials/portfolio-summary?${params}`, { headers: ownerAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load portfolio summary");
      setPortfolio(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  const p = portfolio;
  const netAccent = p ? (p.totalNetIncomeCents > 0 ? "green" : p.totalNetIncomeCents < 0 ? "red" : "") : "";

  return (
    <div className="space-y-6">
      <div>
        <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={0} label="Date range" />
        {filterOpen && (
          <FilterPanelBody>
            <FilterSection title="Date range" first>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <DateField label="From" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                <DateField label="To"   value={range.to}   onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
              </div>
            </FilterSection>
            <FilterSectionClear
              hasFilter={range.from !== defaultRange().from || range.to !== defaultRange().to}
              onClear={() => setRange(defaultRange())}
            />
          </FilterPanelBody>
        )}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError("")} />

      {loading && !p ? (
        <p className="loading-text">Loading portfolio summary…</p>
      ) : p && (
        <>
          <Section>
            {/* Mobile KPIs */}
            <div className="sm:hidden mb-3">
              <KpiInlineGrid
                items={[
                  { label: "Earned Income",  value: formatChfCents(p.totalEarnedIncomeCents), tone: "good" },
                  { label: "Total Expenses", value: formatChfCents(p.totalExpensesCents) },
                  { label: "Net Result",     value: formatChfCents(p.totalNetIncomeCents), tone: p.totalNetIncomeCents >= 0 ? "good" : "warn" },
                  { label: "Receivables",    value: formatChfCents(p.totalReceivablesCents), tone: p.totalReceivablesCents > 0 ? "warn" : undefined },
                  { label: "Payables",       value: formatChfCents(p.totalPayablesCents),    tone: p.totalPayablesCents > 0 ? "warn" : undefined },
                ]}
              />
            </div>
            {/* Desktop KPI cards */}
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard label="Earned Income"  value={formatChfCents(p.totalEarnedIncomeCents)} accent="green" />
              <SummaryCard label="Total Expenses" value={formatChfCents(p.totalExpensesCents)} />
              <SummaryCard label="Net Result"     value={formatChfCents(p.totalNetIncomeCents)} accent={netAccent} sub="Income − Expenses" />
              <SummaryCard label="Receivables"    value={formatChfCents(p.totalReceivablesCents)} accent={p.totalReceivablesCents > 0 ? "amber" : ""} sub="Unpaid rent invoices" />
              <SummaryCard label="Payables"       value={formatChfCents(p.totalPayablesCents)} accent={p.totalPayablesCents > 0 ? "amber" : ""} sub="Unpaid supplier invoices" />
            </div>
          </Section>

          <Section title="Buildings">
            {/* Stats row */}
            <div className="flex gap-4 text-xs text-slate-500">
              <span>Avg collection rate: <strong>{formatPercent(p.avgCollectionRate)}</strong></span>
              {p.buildingsInRed > 0 && (
                <span className="text-destructive-text font-medium">
                  {p.buildingsInRed} building{p.buildingsInRed !== 1 ? "s" : ""} need attention
                </span>
              )}
            </div>
            {p.buildings.length === 0 ? (
              <div className="empty-state"><p className="empty-state-text">No buildings in this portfolio yet.</p></div>
            ) : (
              <>
                {/* Mobile */}
                <div className="md:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                  {(buildingsExpanded ? p.buildings : p.buildings.slice(0, 5)).map((b) => (
                    <div key={b.buildingId} className="table-card">
                      <div className="flex items-center gap-2">
                        <HealthDot health={b.health} />
                        <span className="table-card-head">{b.buildingName}</span>
                      </div>
                      <div className="table-card-footer">
                        <span className={cn("font-medium font-mono", b.netIncomeCents >= 0 ? "text-success-text" : "text-destructive-text")}>
                          Net {formatChfCents(b.netIncomeCents)}
                        </span>
                        <span>Collection {formatPercent(b.collectionRate)}</span>
                        {b.receivablesCents > 0 && <span className="text-amber-700">{formatChfCents(b.receivablesCents)} recv.</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop */}
                <div className="hidden md:block overflow-hidden rounded-lg border border-table-border">
                  <div className="overflow-x-auto">
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>Building</th>
                          <th className="text-right">Earned Income</th>
                          <th className="text-right">Expenses</th>
                          <th className="text-right">Net</th>
                          <th className="text-right">Collection</th>
                          <th className="text-right">Receivables</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(buildingsExpanded ? p.buildings : p.buildings.slice(0, 5)).map((b) => (
                          <tr key={b.buildingId}>
                            <td>
                              <span className="flex items-center gap-2">
                                <HealthDot health={b.health} />
                                <span className="cell-bold">{b.buildingName}</span>
                              </span>
                            </td>
                            <td className="text-right font-mono">{formatChfCents(b.earnedIncomeCents)}</td>
                            <td className="text-right font-mono">{formatChfCents(b.expensesTotalCents)}</td>
                            <td className={cn("text-right font-mono font-semibold", b.netIncomeCents >= 0 ? "text-success-text" : "text-destructive-text")}>
                              {formatChfCents(b.netIncomeCents)}
                            </td>
                            <td className="text-right">{formatPercent(b.collectionRate)}</td>
                            <td className="text-right font-mono">
                              {b.receivablesCents > 0
                                ? <span className="text-amber-700">{formatChfCents(b.receivablesCents)}</span>
                                : <span className="text-slate-400">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {p.buildings.length > 5 && (
                  <div className="expand-footer" onClick={() => setBuildingsExpanded((v) => !v)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                      className={cn("w-4 h-4 transition-transform duration-200", buildingsExpanded ? "rotate-180" : "")}>
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                    {buildingsExpanded ? "Show less" : `Show all ${p.buildings.length} buildings`}
                  </div>
                )}
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Invoices Tab
   ═══════════════════════════════════════════════════════════════ */



function InvoicesTab() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState("incoming");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [invSearch, setInvSearch] = useState("");
  const [tableExpanded, setTableExpanded] = useState(false);
  const deepLinkConsumed = useRef(false);

  const { sortField, sortDir, handleSort } = useLocalSort("createdAt", "desc");

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/owner/invoices", { headers: ownerAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load invoices");
      setInvoices(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Deep-link: navigate to invoice detail from ?invoiceId= param
  useEffect(() => {
    if (!router.isReady) return;
    if (deepLinkConsumed.current) return;
    const qId = router.query.invoiceId;
    if (!qId) return;
    deepLinkConsumed.current = true;
    router.push(`/owner/finance/invoices/${qId}`);
  }, [router.isReady, router.query.invoiceId]);

  const isOutgoing = direction === "outgoing";

  const approvalCount = useMemo(
    () => invoices.filter((inv) => {
      if (inv.status !== "ISSUED") return false;
      if (inv.direction) return inv.direction === "INCOMING";
      return !inv.leaseId;
    }).length,
    [invoices],
  );

  const directionFiltered = useMemo(() => invoices.filter((inv) => {
    if (inv.direction) return isOutgoing ? inv.direction === "OUTGOING" : inv.direction === "INCOMING";
    return isOutgoing ? !!inv.leaseId : !inv.leaseId;
  }), [invoices, isOutgoing]);

  const filteredInvoices = useMemo(() => {
    let list = directionFiltered;
    if (statusFilter !== "ALL") list = list.filter((inv) => inv.status === statusFilter);
    const q = invSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((inv) =>
        (inv.invoiceNumber || "").toLowerCase().includes(q) ||
        (inv.issuerName || "").toLowerCase().includes(q) ||
        (inv.recipientName || "").toLowerCase().includes(q) ||
        (inv.buildingName || "").toLowerCase().includes(q) ||
        (inv.description || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [directionFiltered, statusFilter, invSearch]);

  const sortedInvoices = useMemo(
    () => clientSort(filteredInvoices, sortField, sortDir, fieldExtractor),
    [filteredInvoices, sortField, sortDir],
  );

  const COLLAPSED_ROWS = 10;
  const visibleInvoices = tableExpanded ? sortedInvoices : sortedInvoices.slice(0, COLLAPSED_ROWS);

  const activeFilterCount = [direction !== "incoming", statusFilter !== "ALL"].filter(Boolean).length;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const invoiceColumns = useMemo(() => [
    {
      id: "status",
      label: "Status",
      sortable: true,
      defaultVisible: true,
      render: (inv) => (
        <div className="flex items-center flex-wrap gap-1">
          {!isOutgoing && <SourceChannelIcon channel={inv.sourceChannel} />}
          <Badge variant={invoiceVariant(inv.status)} size="sm">{inv.status}</Badge>
          <IngestionBadge ingestionStatus={inv.ingestionStatus} />
        </div>
      ),
    },
    {
      id: "invoiceNumber",
      label: "Invoice #",
      sortable: true,
      defaultVisible: true,
      className: "cell-bold",
      render: (inv) => inv.invoiceNumber || inv.id?.slice(0, 8) || "Draft",
    },
    {
      id: "issuerOrRecipient",
      label: isOutgoing ? "Tenant" : "Issuer",
      sortable: false,
      defaultVisible: true,
      render: (inv) => (isOutgoing ? inv.recipientName : inv.issuerName) || <span className="text-slate-400">—</span>,
    },
    {
      id: "createdAt",
      label: "Date",
      sortable: true,
      defaultVisible: true,
      render: (inv) => formatDate(inv.createdAt),
    },
    {
      id: "amount",
      label: "Amount",
      sortable: true,
      defaultVisible: true,
      render: (inv) => formatChf(getInvoiceTotal(inv)),
    },
    {
      id: "actions",
      label: "",
      sortable: false,
      alwaysVisible: true,
      className: "text-right",
      headerClassName: "text-right",
      render: (inv) => (
        <a
          href={`/api/invoices/${inv.id}/pdf`}
          download
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-slate-500 hover:text-slate-700 font-medium no-underline"
        >
          ↓ PDF
        </a>
      ),
    },
  ], [isOutgoing]);

  return (
    <div className="space-y-3">
      <ErrorBanner error={error} onDismiss={() => setError("")} />

      {/* Approval banner */}
      {approvalCount > 0 && !isOutgoing && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-lg">⚡</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700">
              {approvalCount} invoice{approvalCount !== 1 ? "s" : ""} awaiting your approval
            </p>
            <p className="text-xs text-amber-600">Review issued invoices and approve or dispute them</p>
          </div>
          <button onClick={() => setStatusFilter("ISSUED")} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition">
            Review now
          </button>
        </div>
      )}

      {/* Toolbar: search + filter toggle */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          placeholder="Search invoices…"
          value={invSearch}
          onChange={(e) => { setInvSearch(e.target.value); setTableExpanded(false); }}
          className="filter-input flex-1 min-w-0 mb-0"
        />
        <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeFilterCount} />
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <FilterPanelBody>
          <FilterSection title="Direction" first>
            <div className="flex flex-wrap gap-2">
              {[{ key: "incoming", label: "📥 Incoming" }, { key: "outgoing", label: "📤 Outgoing" }].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setDirection(key); setStatusFilter("ALL"); setTableExpanded(false); }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                    direction === key ? "bg-brand text-white border-brand" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </FilterSection>
          <FilterSection title="Status">
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setStatusFilter(key); setTableExpanded(false); }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                    statusFilter === key ? "bg-brand text-white border-brand" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </FilterSection>
          <FilterSectionClear hasFilter={activeFilterCount > 0} onClear={() => { setDirection("incoming"); setStatusFilter("ALL"); setTableExpanded(false); }} />
        </FilterPanelBody>
      )}

      {loading ? (
        <p className="loading-text">Loading invoices…</p>
      ) : filteredInvoices.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">{invoices.length === 0 ? "No invoices yet." : "No invoices match this filter."}</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
            {visibleInvoices.map((inv) => (
              <div
                key={inv.id}
                className="table-card cursor-pointer hover:bg-slate-50/80 transition-colors"
                onClick={() => router.push(`/owner/finance/invoices/${inv.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500">{inv.invoiceNumber || inv.id?.slice(0, 8)}</span>
                  <Badge variant={invoiceVariant(inv.status)} size="sm">{inv.status}</Badge>
                </div>
                <p className="table-card-head mt-1">{(isOutgoing ? inv.recipientName : inv.issuerName) || "—"}</p>
                <div className="table-card-footer">
                  <span className="font-medium">{formatChf(getInvoiceTotal(inv))}</span>
                  <span>{formatDate(inv.createdAt)}</span>
                </div>
              </div>
            ))}
            <div className="expand-footer" onClick={() => setTableExpanded((e) => !e)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className={cn("w-4 h-4 transition-transform duration-200", tableExpanded ? "rotate-180" : "")}>
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              {tableExpanded ? "Show less" : `Show all ${sortedInvoices.length} invoice${sortedInvoices.length !== 1 ? "s" : ""}`}
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <ConfigurableTable
              tableId="owner-finance-invoices"
              columns={invoiceColumns}
              data={visibleInvoices}
              rowKey="id"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              onRowClick={(inv) => router.push(`/owner/finance/invoices/${inv.id}`)}
              emptyState="No invoices match this filter."
            />
            <div className="expand-footer" onClick={() => setTableExpanded((e) => !e)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className={cn("w-4 h-4 transition-transform duration-200", tableExpanded ? "rotate-180" : "")}>
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              {tableExpanded ? "Show less" : `Show all ${sortedInvoices.length} invoice${sortedInvoices.length !== 1 ? "s" : ""}`}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════ */

export default function OwnerFinance() {
  const router = useRouter();

  const tabKeys = FINANCE_TABS.map((t) => t.key);
  const activeTabKey = router.isReady && tabKeys.includes(router.query.tab) ? router.query.tab : "overview";

  const setActiveTabKey = useCallback((key) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: key } },
      undefined,
      { shallow: true },
    );
  }, [router]);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <OwnerPicker />
        <PageHeader
          title="Finance"
          subtitle="Portfolio summary, invoices, and cashflow planning"
        />
        <PageContent>
          <div>
            <ScrollableTabs activeIndex={FINANCE_TABS.findIndex((t) => t.key === activeTabKey)}>
              {FINANCE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTabKey(tab.key)}
                  className={activeTabKey === tab.key ? "tab-btn-active" : "tab-btn"}
                >
                  {tab.label}
                </button>
              ))}
            </ScrollableTabs>
          </div>

          {activeTabKey === "overview" && <OverviewTab />}
          {activeTabKey === "invoices" && <InvoicesTab />}
          {/* Planning tab: ownerMode hides Create button and shows Approve on SUBMITTED plans */}
          {activeTabKey === "planning" && <CashflowPlansList ownerMode />}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
