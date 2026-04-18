import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Panel from "./layout/Panel";
import Badge from "./ui/Badge";
import { billingEntityVariant } from "../lib/statusVariants";
import { authHeaders as getAuthHeaders } from "../lib/api";
import { Dialog, DialogContent, DialogHeader } from "./ui/Dialog";

import { cn } from "../lib/utils";
const DEFAULT_FORM = {
  type: "ORG",
  contractorId: "",
  name: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  country: "CH",
  iban: "",
  vatNumber: "",
  defaultVatRate: "7.7",
};

const TYPE_LABEL = { ORG: "Organization", CONTRACTOR: "Contractor", OWNER: "Owner" };
const TYPE_CLS = {
  ORG: "bg-blue-100 text-blue-700",
  CONTRACTOR: "bg-amber-100 text-amber-700",
  OWNER: "bg-green-100 text-green-700",
};

/* ─── Modal ──────────────────────────────────────────────── */

function BillingEntityModal({ isOpen, onClose, editEntity, contractors, onSaved }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const contractorMap = useMemo(() => {
    return new Map(contractors.map((c) => [c.id, c]));
  }, [contractors]);

  const isEditing = Boolean(editEntity);

  useEffect(() => {
    if (editEntity) {
      setForm({
        type: editEntity.type || "ORG",
        contractorId: editEntity.contractorId || "",
        name: editEntity.name || "",
        addressLine1: editEntity.addressLine1 || "",
        addressLine2: editEntity.addressLine2 || "",
        postalCode: editEntity.postalCode || "",
        city: editEntity.city || "",
        country: editEntity.country || "CH",
        iban: editEntity.iban || "",
        vatNumber: editEntity.vatNumber || "",
        defaultVatRate: String(editEntity.defaultVatRate ?? "7.7"),
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setError("");
  }, [editEntity, isOpen]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      type: form.type,
      contractorId: form.type === "CONTRACTOR" && form.contractorId ? form.contractorId : undefined,
      name: form.name.trim(),
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim() || undefined,
      postalCode: form.postalCode.trim(),
      city: form.city.trim(),
      country: form.country.trim() || "CH",
      iban: form.iban.trim(),
      vatNumber: form.vatNumber.trim() || undefined,
      defaultVatRate: form.defaultVatRate ? Number(form.defaultVatRate) : undefined,
    };

    try {
      const url = isEditing ? `/api/billing-entities/${editEntity.id}` : "/api/billing-entities";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `Request failed (${res.status})`);
      onSaved(isEditing ? "updated" : "created");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader title={isEditing ? "Edit billing entity" : "New billing entity"} />

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => {
                setField("type", e.target.value);
                if (e.target.value !== "CONTRACTOR") setField("contractorId", "");
              }}
              disabled={isEditing}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
            >
              <option value="ORG">Organization</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>

          {form.type === "CONTRACTOR" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Link contractor</label>
              <select
                value={form.contractorId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const contractor = contractorMap.get(nextId);
                  setForm((prev) => ({
                    ...prev,
                    contractorId: nextId,
                    name: contractor?.name || prev.name,
                    addressLine1: contractor?.addressLine1 || prev.addressLine1,
                    addressLine2: contractor?.addressLine2 || prev.addressLine2,
                    postalCode: contractor?.postalCode || prev.postalCode,
                    city: contractor?.city || prev.city,
                    country: contractor?.country || prev.country,
                    iban: contractor?.iban || prev.iban,
                    vatNumber: contractor?.vatNumber || prev.vatNumber,
                    defaultVatRate: contractor?.defaultVatRate ? String(contractor.defaultVatRate) : prev.defaultVatRate,
                  }));
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
              >
                <option value="">Select contractor</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Selecting a contractor will auto-fill fields.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input value={form.name} onChange={(e) => setField("name", e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address line 1</label>
            <input value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address line 2</label>
            <input value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Postal code</label>
              <input value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <input value={form.city} onChange={(e) => setField("city", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
              <input value={form.country} onChange={(e) => setField("country", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">IBAN</label>
            <input value={form.iban} onChange={(e) => setField("iban", e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">VAT number</label>
              <input value={form.vatNumber} onChange={(e) => setField("vatNumber", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default VAT rate (%)</label>
              <input type="number" step="0.1" value={form.defaultVatRate}
                onChange={(e) => setField("defaultVatRate", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main component ─────────────────────────────────────── */

export default function BillingEntityManager() {
  const router = useRouter();
  const [entities, setEntities] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editEntity, setEditEntity] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [entRes, conRes] = await Promise.all([
        fetch("/api/billing-entities", { headers: { "Content-Type": "application/json", ...getAuthHeaders() } }),
        fetch("/api/contractors", { headers: { "Content-Type": "application/json", ...getAuthHeaders() } }),
      ]);
      const entData = await entRes.json();
      const conData = await conRes.json();
      if (!entRes.ok) throw new Error(entData?.error?.message || "Failed to load billing entities");
      setEntities(Array.isArray(entData?.data) ? entData.data : []);
      setContractors(Array.isArray(conData?.data) ? conData.data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openCreate() {
    setEditEntity(null);
    setShowModal(true);
  }

  function openEdit(entity, e) {
    e.stopPropagation();
    setEditEntity(entity);
    setShowModal(true);
  }

  async function handleDelete(entityId, e) {
    e.stopPropagation();
    if (!confirm("Delete this billing entity?")) return;
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/billing-entities/${entityId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || `Failed to delete (${res.status})`);
      }
      setNotice("Billing entity deleted.");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSaved(action) {
    setShowModal(false);
    setEditEntity(null);
    setNotice(`Billing entity ${action}.`);
    loadData();
  }

  return (
    <>
      {/* Header row with count + new entry button */}
      <div className="flex items-center justify-between mb-1">
        <span className="tab-panel-count">
          {entities.length} billing entit{entities.length !== 1 ? "ies" : "y"}
        </span>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New entry
        </button>
      </div>

      {(error || notice) && (
        <div className={cn("mb-3 rounded-lg border px-4 py-2.5 text-sm", error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700")}>
          {error || notice}
          <button onClick={() => { setError(""); setNotice(""); }} className="ml-3 opacity-60 hover:opacity-100" aria-label="Dismiss">✕</button>
        </div>
      )}

      <Panel bodyClassName="p-0">
        {loading ? (
          <p className="loading-text">Loading billing entities…</p>
        ) : entities.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No billing entities yet. Use the "+ New entry" button to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="inline-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>IBAN</th>
                  <th>VAT rate</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity) => (
                  <tr
                    key={entity.id}
                    onClick={() => router.push(`/manager/finance/billing-entities/${entity.id}`)}
                    className="cursor-pointer"
                  >
                    <td className="cell-bold">{entity.name}</td>
                    <td>
                      <Badge variant={billingEntityVariant(entity.type)} size="sm">
                        {TYPE_LABEL[entity.type] || entity.type}
                      </Badge>
                    </td>
                    <td className="text-slate-500">{entity.city ? `${entity.postalCode} ${entity.city}` : "—"}</td>
                    <td className="text-slate-500 font-mono text-xs">{entity.iban || "—"}</td>
                    <td className="text-slate-500">{entity.defaultVatRate != null ? `${entity.defaultVatRate}%` : "—"}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => openEdit(entity, e)}
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => handleDelete(entity.id, e)}
                          className="rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Create / Edit modal */}
      <BillingEntityModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditEntity(null); }}
        editEntity={editEntity}
        contractors={contractors}
        onSaved={handleSaved}
      />
    </>
  );
}
