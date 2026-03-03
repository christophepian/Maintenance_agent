import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import { formatDate } from "../../../lib/format";
import PageContent from "../../../components/layout/PageContent";
import Section from "../../../components/layout/Section";

export default function LeaseTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create panel state
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState("scratch"); // "scratch" | "lease"
  const [leases, setLeases] = useState([]);
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  // From-lease form
  const [leaseForm, setLeaseForm] = useState({
    leaseId: "",
    templateName: "",
    buildingId: "",
  });

  // From-scratch form
  const [scratchForm, setScratchForm] = useState({
    templateName: "",
    buildingId: "",
    landlordName: "",
    landlordAddress: "",
    landlordZipCity: "",
    landlordPhone: "",
    landlordEmail: "",
    objectType: "APPARTEMENT",
    roomsCount: "",
    noticeRule: "3_MONTHS",
    paymentDueDayOfMonth: "1",
    paymentIban: "",
    referenceRatePercent: "1.75",
    depositDueRule: "AT_SIGNATURE",
    includesHouseRules: true,
  });

  // Load buildings once
  useEffect(() => {
    fetch("/api/buildings")
      .then((r) => r.json())
      .then((json) => setBuildings(json.data || []))
      .catch(() => {});
  }, []);

  // Load templates (optionally filtered by building)
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const qs = selectedBuildingId
        ? `?buildingId=${selectedBuildingId}`
        : "";
      const res = await fetch(`/api/lease-templates${qs}`);
      const json = await res.json();
      setTemplates(json.data || []);
      setError(null);
    } catch (err) {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [selectedBuildingId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Load leases when "From Lease" tab is active
  useEffect(() => {
    if (!showCreate || createMode !== "lease") return;
    fetch("/api/leases")
      .then((r) => r.json())
      .then((json) => setLeases(json.data || []))
      .catch(() => {});
  }, [showCreate, createMode]);

  // Handle "from lease" creation
  async function handleCreateFromLease(e) {
    e.preventDefault();
    setCreateError(null);
    if (!leaseForm.leaseId || !leaseForm.templateName) {
      setCreateError("Please select a source lease and provide a template name.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/lease-templates/from-lease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaseId: leaseForm.leaseId,
          templateName: leaseForm.templateName.trim(),
          buildingId: leaseForm.buildingId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json.error?.message || "Failed to create template"); return; }
      setShowCreate(false);
      setLeaseForm({ leaseId: "", templateName: "", buildingId: "" });
      fetchTemplates();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  // Handle "from scratch" creation
  async function handleCreateFromScratch(e) {
    e.preventDefault();
    setCreateError(null);
    if (!scratchForm.buildingId || !scratchForm.templateName || !scratchForm.landlordName || !scratchForm.landlordAddress || !scratchForm.landlordZipCity) {
      setCreateError("Building, template name, landlord name, address, and zip/city are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/lease-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: scratchForm.templateName.trim(),
          buildingId: scratchForm.buildingId,
          landlordName: scratchForm.landlordName.trim(),
          landlordAddress: scratchForm.landlordAddress.trim(),
          landlordZipCity: scratchForm.landlordZipCity.trim(),
          landlordPhone: scratchForm.landlordPhone.trim() || undefined,
          landlordEmail: scratchForm.landlordEmail.trim() || undefined,
          objectType: scratchForm.objectType,
          roomsCount: scratchForm.roomsCount || undefined,
          noticeRule: scratchForm.noticeRule,
          paymentDueDayOfMonth: parseInt(scratchForm.paymentDueDayOfMonth) || 1,
          paymentIban: scratchForm.paymentIban.trim() || undefined,
          referenceRatePercent: scratchForm.referenceRatePercent || undefined,
          depositDueRule: scratchForm.depositDueRule,
          includesHouseRules: scratchForm.includesHouseRules,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json.error?.message || "Failed to create template"); return; }
      setShowCreate(false);
      setScratchForm({ templateName: "", buildingId: "", landlordName: "", landlordAddress: "", landlordZipCity: "", landlordPhone: "", landlordEmail: "", objectType: "APPARTEMENT", roomsCount: "", noticeRule: "3_MONTHS", paymentDueDayOfMonth: "1", paymentIban: "", referenceRatePercent: "1.75", depositDueRule: "AT_SIGNATURE", includesHouseRules: true });
      fetchTemplates();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  // Auto-fill landlord address from selected building
  function onScratchBuildingChange(id) {
    setScratchForm((f) => ({ ...f, buildingId: id }));
    const b = buildings.find((x) => x.id === id);
    if (b && !scratchForm.landlordAddress) {
      setScratchForm((f) => ({
        ...f,
        buildingId: id,
        landlordAddress: b.address?.split(",")[0]?.trim() || "",
        landlordZipCity: b.address?.split(",").slice(1).join(",").trim() || "",
      }));
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Lease Templates"
          subtitle="Reusable lease templates for the rental pipeline"
          actions={
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {showCreate ? "Cancel" : "+ New Template"}
            </button>
          }
        />
        <PageContent>
          {/* Create template panel */}
          {showCreate && (
            <Section title="Create New Template">
              {/* Tab selector */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setCreateMode("scratch"); setCreateError(null); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    createMode === "scratch"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  From Scratch
                </button>
                <button
                  onClick={() => { setCreateMode("lease"); setCreateError(null); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    createMode === "lease"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Copy from Existing Lease
                </button>
              </div>

              {createError && <p className="text-sm text-red-600 mb-4">{createError}</p>}

              {/* FROM SCRATCH form */}
              {createMode === "scratch" && (
                <form onSubmit={handleCreateFromScratch} className="bg-white rounded-lg border p-6 space-y-4 max-w-2xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
                      <input type="text" value={scratchForm.templateName}
                        onChange={(e) => setScratchForm((f) => ({ ...f, templateName: e.target.value }))}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        placeholder="e.g. Standard 3-room apartment" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Building *</label>
                      <select value={scratchForm.buildingId}
                        onChange={(e) => onScratchBuildingChange(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="">Select a building...</option>
                        {buildings.map((b) => (
                          <option key={b.id} value={b.id}>{b.name} — {b.address}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3">§1 Landlord / Régie</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Landlord Name *</label>
                        <input type="text" value={scratchForm.landlordName}
                          onChange={(e) => setScratchForm((f) => ({ ...f, landlordName: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          placeholder="e.g. Régie du Lac SA" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Address *</label>
                        <input type="text" value={scratchForm.landlordAddress}
                          onChange={(e) => setScratchForm((f) => ({ ...f, landlordAddress: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          placeholder="e.g. Rue du Lac 15" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Zip / City *</label>
                        <input type="text" value={scratchForm.landlordZipCity}
                          onChange={(e) => setScratchForm((f) => ({ ...f, landlordZipCity: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          placeholder="e.g. 1003 Lausanne" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                        <input type="text" value={scratchForm.landlordPhone}
                          onChange={(e) => setScratchForm((f) => ({ ...f, landlordPhone: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          placeholder="+41 21 ..." />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input type="text" value={scratchForm.landlordEmail}
                          onChange={(e) => setScratchForm((f) => ({ ...f, landlordEmail: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          placeholder="regie@example.ch" />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3">§2 Object & Terms</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Object Type</label>
                        <select value={scratchForm.objectType}
                          onChange={(e) => setScratchForm((f) => ({ ...f, objectType: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm">
                          <option value="APPARTEMENT">Apartment</option>
                          <option value="MAISON">House</option>
                          <option value="CHAMBRE_MEUBLEE">Furnished Room</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Rooms</label>
                        <input type="text" value={scratchForm.roomsCount}
                          onChange={(e) => setScratchForm((f) => ({ ...f, roomsCount: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          placeholder="e.g. 3.5" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notice Rule</label>
                        <select value={scratchForm.noticeRule}
                          onChange={(e) => setScratchForm((f) => ({ ...f, noticeRule: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm">
                          <option value="3_MONTHS">3 months</option>
                          <option value="EXTENDED">Extended (custom)</option>
                          <option value="2_WEEKS">2 weeks</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Deposit Due</label>
                        <select value={scratchForm.depositDueRule}
                          onChange={(e) => setScratchForm((f) => ({ ...f, depositDueRule: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm">
                          <option value="AT_SIGNATURE">At signature</option>
                          <option value="BY_START">By lease start</option>
                          <option value="BY_DATE">By specific date</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3">§6 Payment</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Due Day</label>
                        <input type="number" min="1" max="28" value={scratchForm.paymentDueDayOfMonth}
                          onChange={(e) => setScratchForm((f) => ({ ...f, paymentDueDayOfMonth: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Payment IBAN</label>
                        <input type="text" value={scratchForm.paymentIban}
                          onChange={(e) => setScratchForm((f) => ({ ...f, paymentIban: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          placeholder="CH93 0076 2011 6238 5295 7" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reference Rate %</label>
                        <input type="text" value={scratchForm.referenceRatePercent}
                          onChange={(e) => setScratchForm((f) => ({ ...f, referenceRatePercent: e.target.value }))}
                          className="w-full border rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <input type="checkbox" id="houseRules" checked={scratchForm.includesHouseRules}
                          onChange={(e) => setScratchForm((f) => ({ ...f, includesHouseRules: e.target.checked }))}
                          className="rounded" />
                        <label htmlFor="houseRules" className="text-sm text-slate-700">Includes house rules</label>
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={creating}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {creating ? "Creating..." : "Create Template"}
                  </button>
                </form>
              )}

              {/* FROM LEASE form */}
              {createMode === "lease" && (
                <form onSubmit={handleCreateFromLease} className="bg-white rounded-lg border p-6 space-y-4 max-w-2xl">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
                    <input type="text" value={leaseForm.templateName}
                      onChange={(e) => setLeaseForm((f) => ({ ...f, templateName: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="e.g. Standard 3-room apartment" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source Lease *</label>
                    <select value={leaseForm.leaseId}
                      onChange={(e) => setLeaseForm((f) => ({ ...f, leaseId: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm">
                      <option value="">Select a lease to copy from...</option>
                      {leases.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.tenantName} — {l.unit?.unitNumber || "?"} @ {l.unit?.building?.name || "?"} ({l.status})
                        </option>
                      ))}
                    </select>
                    {leases.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No leases found. Use the &quot;From Scratch&quot; tab to create a template without an existing lease.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Building (optional)</label>
                    <select value={leaseForm.buildingId}
                      onChange={(e) => setLeaseForm((f) => ({ ...f, buildingId: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm">
                      <option value="">All buildings (global)</option>
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} — {b.address}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={creating}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {creating ? "Creating..." : "Create Template"}
                  </button>
                </form>
              )}
            </Section>
          )}

          {/* Filter by building */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600">Filter by building:</label>
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm"
            >
              <option value="">All buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Templates list */}
          {loading ? (
            <p className="text-sm text-slate-500">Loading templates...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : templates.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center text-slate-500">
              <p className="text-lg mb-2">No lease templates found</p>
              <p className="text-sm">
                Click &quot;+ Save Lease as Template&quot; to create a reusable
                template from an existing lease. Templates are used
                automatically when owners select tenants in the rental pipeline.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Template Name
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Building
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Net Rent
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Rooms
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Created
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {templates.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        {t.templateName || "Unnamed template"}
                      </td>
                      <td className="px-4 py-3">
                        {t.unit?.building?.name || "Global"}
                      </td>
                      <td className="px-4 py-3">
                        {t.netRentChf != null
                          ? `CHF ${t.netRentChf}.-`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">{t.roomsCount || "—"}</td>
                      <td className="px-4 py-3">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            router.push(`/manager/leases/${t.id}`)
                          }
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View →
                        </button>
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
