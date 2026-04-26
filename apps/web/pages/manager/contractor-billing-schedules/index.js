import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { fetchWithAuth, postWithAuth } from "../../../lib/api";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { useTableSort, clientSort } from "../../../lib/tableUtils";
import { formatChfCents, formatDate } from "../../../lib/format";
import { billingScheduleVariant } from "../../../lib/statusVariants";

const FREQUENCY_LABELS = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-Annual",
  ANNUAL: "Annual",
};

const TABS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "PAUSED", label: "Paused" },
  { key: "COMPLETED", label: "Completed" },
];
const TAB_KEYS = TABS.map((t) => t.key.toLowerCase());

const CBS_SORT_FIELDS = ["contractor", "description", "frequency", "amount", "status", "nextPeriod", "building"];

function cbsFieldExtractor(s, field) {
  switch (field) {
    case "contractor": return (s.contractor?.name || "").toLowerCase();
    case "description": return (s.description || "").toLowerCase();
    case "frequency": return s.frequency || "";
    case "amount": return s.amountCents ?? 0;
    case "status": return s.status || "";
    case "nextPeriod": return s.nextPeriodStart || "";
    case "building": return (s.building?.name || "").toLowerCase();
    default: return "";
  }
}

const CBS_COLUMNS = [
  {
    id: "contractor",
    label: "Contractor",
    sortable: true,
    alwaysVisible: true,
    render: (s) => (
      <Link href={`/manager/contractor-billing-schedules/${s.id}`} className="cell-link" onClick={(e) => e.stopPropagation()}>
        {s.contractor?.name || "\u2014"}
      </Link>
    ),
  },
  {
    id: "description",
    label: "Description",
    sortable: true,
    defaultVisible: true,
    render: (s) => s.description || "\u2014",
  },
  {
    id: "frequency",
    label: "Frequency",
    sortable: true,
    defaultVisible: true,
    render: (s) => FREQUENCY_LABELS[s.frequency] || s.frequency,
  },
  {
    id: "amount",
    label: "Amount",
    sortable: true,
    defaultVisible: true,
    className: "text-right",
    render: (s) => <span className="tabular-nums cell-bold">{formatChfCents(s.amountCents)}</span>,
  },
  {
    id: "status",
    label: "Status",
    sortable: true,
    defaultVisible: true,
    render: (s) => <Badge variant={billingScheduleVariant(s.status)}>{s.status}</Badge>,
  },
  {
    id: "nextPeriod",
    label: "Next Period",
    sortable: true,
    defaultVisible: true,
    render: (s) => formatDate(s.nextPeriodStart),
  },
  {
    id: "building",
    label: "Building",
    sortable: true,
    defaultVisible: true,
    render: (s) => s.building?.name || "\u2014",
  },
  {
    id: "action",
    label: "",
    alwaysVisible: true,
    render: (s) => (
      <Link href={`/manager/contractor-billing-schedules/${s.id}`} className="cell-link" onClick={(e) => e.stopPropagation()}>View</Link>
    ),
  },
];

export default function ContractorBillingSchedulesList() {
  const router = useRouter();
  const activeTab = router.isReady
    ? Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0
    : 0;
  const setActiveTab = useCallback(
    (index) => {
      router.push(
        { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  const [schedules, setSchedules] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const { sortField, sortDir, handleSort } = useTableSort(router, CBS_SORT_FIELDS, { defaultField: "contractor", defaultDir: "asc" });
  const sortedSchedules = useMemo(() => clientSort(schedules, sortField, sortDir, cbsFieldExtractor), [schedules, sortField, sortDir]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    contractorId: "",
    description: "",
    frequency: "MONTHLY",
    anchorDay: 1,
    nextPeriodStart: new Date().toISOString().slice(0, 10),
    amountCents: "",
    vatRate: "8.1",
    buildingId: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (TABS[activeTab].key !== "ALL") params.set("status", TABS[activeTab].key);
      const res = await fetchWithAuth(`/api/contractor-billing-schedules?${params}`);
      if (res.ok) {
        const json = await res.json();
        setSchedules(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load contractor billing schedules:", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchWithAuth("/api/contractors")
      .then((r) => r.json())
      .then((json) => setContractors(json.data || []))
      .catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        contractorId: form.contractorId,
        description: form.description,
        frequency: form.frequency,
        anchorDay: parseInt(form.anchorDay, 10),
        startDate: new Date(form.nextPeriodStart).toISOString(),
        amountCents: Math.round(parseFloat(form.amountCents) * 100),
        vatRate: parseFloat(form.vatRate),
        buildingId: form.buildingId || null,
      };
      const res = await postWithAuth("/api/contractor-billing-schedules", body);
      if (res.ok) {
        setShowCreate(false);
        setForm({
          contractorId: "",
          description: "",
          frequency: "MONTHLY",
          anchorDay: 1,
          nextPeriodStart: new Date().toISOString().slice(0, 10),
          amountCents: "",
          vatRate: "8.1",
          buildingId: "",
        });
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to create schedule");
      }
    } catch (e) {
      alert("Error creating schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageShell>
        <PageHeader
          title="Contractor Billing"
          subtitle="Recurring billing schedules for contractor services"
          action={
            <Button
              variant={showCreate ? "ghost" : "primary"}
              size="sm"
              onClick={() => setShowCreate(!showCreate)}
            >
              {showCreate ? "Cancel" : "+ New Schedule"}
            </Button>
          }
        />
        <PageContent>
          {/* Create form */}
          {showCreate && (
            <Panel className="mb-4">
              <h3 className="font-semibold text-slate-800 mb-3">Create Billing Schedule</h3>
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contractor *</label>
                  <select
                    value={form.contractorId}
                    onChange={(e) => setForm({ ...form, contractorId: e.target.value })}
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select contractor…</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                    placeholder="e.g. Monthly cleaning service"
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frequency *</label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Anchor Day (1-28) *</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={form.anchorDay}
                    onChange={(e) => setForm({ ...form, anchorDay: e.target.value })}
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={form.nextPeriodStart}
                    onChange={(e) => setForm({ ...form, nextPeriodStart: e.target.value })}
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount (CHF) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amountCents}
                    onChange={(e) => setForm({ ...form, amountCents: e.target.value })}
                    required
                    placeholder="e.g. 500.00"
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VAT Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.vatRate}
                    onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={saving} size="sm">
                    {saving ? "Creating…" : "Create Schedule"}
                  </Button>
                </div>
              </form>
            </Panel>
          )}

          {/* Tabs */}
          <div className="tab-strip">
            {TABS.map((t, i) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "pill-tab-active" : "pill-tab"}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="loading-text p-4">Loading…</p>
          ) : (
            <ConfigurableTable
                tableId="manager-contractor-billing-schedules"
                columns={CBS_COLUMNS}
                data={sortedSchedules}
                rowKey={(s) => s.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(s) => router.push(`/manager/contractor-billing-schedules/${s.id}`)}
                emptyState={
                  <div className="empty-state">
                    <p className="empty-state-text">No contractor billing schedules found.</p>
                  </div>
                }
            />
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
