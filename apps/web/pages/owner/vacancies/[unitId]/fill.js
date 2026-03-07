import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import Section from "../../../../components/layout/Section";
import { authHeaders } from "../../../../lib/api";
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function FillVacancyWizard() {
  const router = useRouter();
  const { unitId } = router.query;

  const [unit, setUnit] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [search, setSearch] = useState("");
  const [newTenant, setNewTenant] = useState({ name: "", phone: "", email: "" });
  const [leaseForm, setLeaseForm] = useState({ startDate: "", netRentChf: "" });

  // Set today's date client-side to avoid SSR hydration mismatch
  useEffect(() => {
    setLeaseForm((prev) => prev.startDate ? prev : { ...prev, startDate: todayIso() });
  }, []);
  const [occupancyAssigned, setOccupancyAssigned] = useState(false);
  const [leaseId, setLeaseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!router.isReady || !unitId) return;
    loadData();
  }, [router.isReady, unitId]);

  async function fetchJson(path, options) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...authHeaders() },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.message || "Request failed");
    }
    return data;
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [unitRes, tenantsRes] = await Promise.all([
        fetchJson(`/api/units/${unitId}`),
        fetchJson("/api/tenants"),
      ]);
      setUnit(unitRes.data || null);
      setTenants(tenantsRes.data || []);
    } catch (err) {
      setError(err?.message || "Failed to load vacancy data");
    } finally {
      setLoading(false);
    }
  }

  const filteredTenants = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.trim().toLowerCase();
    return tenants.filter((tenant) => {
      return (
        tenant.name?.toLowerCase().includes(q) ||
        tenant.phone?.toLowerCase().includes(q) ||
        tenant.email?.toLowerCase().includes(q)
      );
    });
  }, [tenants, search]);

  async function handleCreateTenant() {
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        name: newTenant.name,
        phone: newTenant.phone,
        email: newTenant.email || undefined,
      };
      const res = await fetchJson("/api/tenants", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const created = res.data;
      setTenants((prev) => [created, ...prev]);
      setSelectedTenant(created);
      setSuccess("Tenant created and selected.");
    } catch (err) {
      setError(err?.message || "Failed to create tenant");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssignOccupancy() {
    if (!selectedTenant) {
      setError("Select a tenant before assigning occupancy.");
      return;
    }
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/units/${unitId}/tenants`, {
        method: "POST",
        body: JSON.stringify({ tenantId: selectedTenant.id }),
      });
      setOccupancyAssigned(true);
      setSuccess("Tenant assigned to unit.");
    } catch (err) {
      setError(err?.message || "Failed to assign tenant to unit");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreateLease() {
    if (!selectedTenant) {
      setError("Select a tenant before creating a lease.");
      return;
    }
    if (!leaseForm.startDate || !leaseForm.netRentChf) {
      setError("Provide a start date and net rent.");
      return;
    }
    const netRentChf = Number(leaseForm.netRentChf);
    if (!Number.isFinite(netRentChf)) {
      setError("Net rent must be a valid number.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        unitId,
        tenantName: selectedTenant.name || "Tenant",
        tenantPhone: selectedTenant.phone,
        tenantEmail: selectedTenant.email || undefined,
        startDate: leaseForm.startDate,
        netRentChf: Math.round(netRentChf),
        isFixedTerm: false,
      };
      const res = await fetchJson("/api/leases", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setLeaseId(res.data?.id || null);
      setSuccess("Lease created in DRAFT status.");
    } catch (err) {
      setError(err?.message || "Failed to create lease");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLeaseAction(action) {
    if (!leaseId) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/leases/${leaseId}/${action}`, { method: "POST" });
      setSuccess(action === "activate" ? "Lease activated." : "Lease marked ready to sign.");
    } catch (err) {
      setError(err?.message || "Lease action failed");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Fill vacancy"
          subtitle={unit ? `Unit ${unit.unitNumber || "—"}` : ""}
        />

        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {loading && <div className="text-sm text-slate-600">Loading vacancy data...</div>}

          {!loading && (
            <div className="space-y-6">
              <Panel title="Step 1: Select or create tenant">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700">Search tenants</label>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Search by name, phone, or email"
                    />
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                      {filteredTenants.length === 0 && (
                        <div className="text-sm text-slate-500">No tenants found.</div>
                      )}
                      {filteredTenants.map((tenant) => (
                        <button
                          key={tenant.id}
                          onClick={() => setSelectedTenant(tenant)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                            selectedTenant?.id === tenant.id
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="font-medium text-slate-900">
                            {tenant.name || "Unnamed tenant"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {tenant.phone || "—"} {tenant.email ? `· ${tenant.email}` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700">Create new tenant</label>
                    <input
                      value={newTenant.name}
                      onChange={(e) => setNewTenant((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Tenant name"
                    />
                    <input
                      value={newTenant.phone}
                      onChange={(e) => setNewTenant((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Phone (+41...)"
                    />
                    <input
                      value={newTenant.email}
                      onChange={(e) => setNewTenant((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Email (optional)"
                    />
                    <button
                      onClick={handleCreateTenant}
                      disabled={actionLoading}
                      className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                    >
                      {actionLoading ? "Creating..." : "Create tenant"}
                    </button>
                  </div>
                </div>
              </Panel>

              <Panel title="Step 2: Assign tenant to unit">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-700">
                    Selected tenant: {selectedTenant?.name || "None"}
                  </div>
                  <button
                    onClick={handleAssignOccupancy}
                    disabled={actionLoading || occupancyAssigned}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
                  >
                    {occupancyAssigned ? "Assigned" : "Assign occupancy"}
                  </button>
                </div>
              </Panel>

              <Panel title="Step 3: Create lease (DRAFT)">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Lease start date</label>
                    <input
                      type="date"
                      value={leaseForm.startDate}
                      onChange={(e) => setLeaseForm((prev) => ({ ...prev, startDate: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Net rent (CHF)</label>
                    <input
                      type="number"
                      value={leaseForm.netRentChf}
                      onChange={(e) => setLeaseForm((prev) => ({ ...prev, netRentChf: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="e.g. 1850"
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={handleCreateLease}
                    disabled={actionLoading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                  >
                    {actionLoading ? "Creating..." : "Create lease"}
                  </button>
                  {leaseId && (
                    <>
                      <button
                        onClick={() => handleLeaseAction("ready-to-sign")}
                        disabled={actionLoading}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Mark ready to sign
                      </button>
                      <button
                        onClick={() => handleLeaseAction("activate")}
                        disabled={actionLoading}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        Activate lease
                      </button>
                    </>
                  )}
                </div>
              </Panel>

              {leaseId && (
                <Section
                  title="Next steps"
                  subtitle="Vacancy will be removed once the lease is ACTIVE."
                >
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    Lease created: <span className="font-semibold">{leaseId}</span>
                  </div>
                </Section>
              )}
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
