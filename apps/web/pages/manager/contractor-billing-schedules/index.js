import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { fetchWithAuth, postWithAuth } from "../../../lib/api";

const STATUS_COLORS = {
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-gray-100 text-gray-800",
};

const FREQUENCY_LABELS = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-Annual",
  ANNUAL: "Annual",
};

export default function ContractorBillingSchedulesList() {
  const router = useRouter();
  const [schedules, setSchedules] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const tabs = ["All", "Active", "Paused", "Completed"];

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
      if (tab !== "All") params.set("status", tab.toUpperCase());
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
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchWithAuth("/api/contractors")
      .then((r) => r.json())
      .then((json) => setContractors(json.data || []))
      .catch(() => {});
  }, []);

  const fmt = (cents) =>
    (cents / 100).toLocaleString("de-CH", { style: "currency", currency: "CHF" });

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
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
            >
              {showCreate ? "Cancel" : "+ New Schedule"}
            </button>
          }
        />
        <PageContent>
          {/* Create form */}
          {showCreate && (
            <Panel className="mb-4">
              <h3 className="font-semibold text-gray-800 mb-3">Create Billing Schedule</h3>
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contractor *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anchor Day (1-28) *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={form.nextPeriodStart}
                    onChange={(e) => setForm({ ...form, nextPeriodStart: e.target.value })}
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (CHF) *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
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
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm disabled:opacity-50"
                  >
                    {saving ? "Creating…" : "Create Schedule"}
                  </button>
                </div>
              </form>
            </Panel>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  tab === t
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Panel>
            {loading ? (
              <p className="text-gray-500 py-4">Loading…</p>
            ) : schedules.length === 0 ? (
              <p className="text-gray-500 py-4">
                No contractor billing schedules found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Contractor</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Frequency</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Next Period</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Building</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schedules.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <a
                            href={`/manager/contractor-billing-schedules/${s.id}`}
                            className="text-indigo-600 hover:underline"
                          >
                            {s.contractor?.name || "—"}
                          </a>
                        </td>
                        <td className="px-3 py-2">{s.description}</td>
                        <td className="px-3 py-2">{FREQUENCY_LABELS[s.frequency] || s.frequency}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmt(s.amountCents)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              STATUS_COLORS[s.status] || "bg-gray-100"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {new Date(s.nextPeriodStart).toLocaleDateString("de-CH")}
                        </td>
                        <td className="px-3 py-2">{s.building?.name || "—"}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() =>
                              router.push(`/manager/contractor-billing-schedules/${s.id}`)
                            }
                            className="text-indigo-600 hover:underline text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
