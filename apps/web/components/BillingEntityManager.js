import { useEffect, useMemo, useState } from "react";

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

export default function BillingEntityManager({ title = "Billing Entities" }) {
  const [entities, setEntities] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);

  const contractorMap = useMemo(() => {
    const entries = contractors.map((contractor) => [contractor.id, contractor]);
    return new Map(entries);
  }, [contractors]);

  const formTitle = useMemo(
    () => (editingId ? "Update billing entity" : "Create billing entity"),
    [editingId]
  );

  function getAuthHeaders() {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("authToken");
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  async function fetchJSON(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // ignore parse error
    }

    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data;
  }

  async function loadEntities() {
    const data = await fetchJSON("/api/billing-entities");
    setEntities(Array.isArray(data?.data) ? data.data : []);
  }

  async function loadContractors() {
    const data = await fetchJSON("/api/contractors");
    setContractors(Array.isArray(data?.data) ? data.data : []);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadEntities(), loadContractors()]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!editingId && entities.some((entity) => entity.type === form.type)) {
      setError("Billing entity already exists for this type.");
      return;
    }

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
      if (editingId) {
        await fetchJSON(`/api/billing-entities/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("Billing entity updated.");
      } else {
        await fetchJSON("/api/billing-entities", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Billing entity created.");
      }
      await loadEntities();
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(entity) {
    setEditingId(entity.id);
    setForm({
      type: entity.type || "ORG",
      contractorId: entity.contractorId || "",
      name: entity.name || "",
      addressLine1: entity.addressLine1 || "",
      addressLine2: entity.addressLine2 || "",
      postalCode: entity.postalCode || "",
      city: entity.city || "",
      country: entity.country || "CH",
      iban: entity.iban || "",
      vatNumber: entity.vatNumber || "",
      defaultVatRate: String(entity.defaultVatRate ?? "7.7"),
    });
  }

  async function handleDelete(entityId) {
    if (!confirm("Delete this billing entity?")) return;
    setError("");
    setNotice("");

    try {
      await fetchJSON(`/api/billing-entities/${entityId}`, { method: "DELETE" });
      setNotice("Billing entity deleted.");
      await loadEntities();
      if (editingId === entityId) resetForm();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <p className="text-sm text-gray-600">
            Manage invoice emitters for contractors, owners, and your organization.
          </p>
        </div>
        <button
          onClick={resetForm}
          className="px-4 py-2 border border-gray-300 rounded bg-white text-sm"
        >
          New entry
        </button>
      </div>

      {(error || notice) && (
        <div
          className={`mb-4 p-3 rounded border ${
            error ? "bg-red-50 border-red-200 text-red-800" : "bg-green-50 border-green-200 text-green-800"
          }`}
        >
          {error || notice}
        </div>
      )}

      <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">{formTitle}</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setField("type", nextType);
                  if (nextType !== "CONTRACTOR") {
                    setField("contractorId", "");
                  }
                }}
                disabled={Boolean(editingId)}
                className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
              >
                <option value="ORG">Organization</option>
                <option value="CONTRACTOR">Contractor</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>

            {form.type === "CONTRACTOR" && (
              <div>
                <label className="block text-sm font-medium mb-1">Link contractor</label>
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
                      defaultVatRate: contractor?.defaultVatRate
                        ? String(contractor.defaultVatRate)
                        : prev.defaultVatRate,
                    }));
                  }}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                >
                  <option value="">Select contractor</option>
                  {contractors.map((contractor) => (
                    <option key={contractor.id} value={contractor.id}>
                      {contractor.name} ({contractor.phone})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecting a contractor will auto-fill the name.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Address line 1</label>
              <input
                value={form.addressLine1}
                onChange={(e) => setField("addressLine1", e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Address line 2</label>
              <input
                value={form.addressLine2}
                onChange={(e) => setField("addressLine2", e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Postal code</label>
                <input
                  value={form.postalCode}
                  onChange={(e) => setField("postalCode", e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <input
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Country</label>
                <input
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">IBAN</label>
              <input
                value={form.iban}
                onChange={(e) => setField("iban", e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">VAT number</label>
                <input
                  value={form.vatNumber}
                  onChange={(e) => setField("vatNumber", e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Default VAT rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.defaultVatRate}
                  onChange={(e) => setField("defaultVatRate", e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 rounded bg-slate-900 text-white text-sm"
            >
              {editingId ? "Save changes" : "Create billing entity"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded border border-gray-300 text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Existing entries</h2>

          {loading ? (
            <p className="text-gray-600">Loading billing entities...</p>
          ) : entities.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded p-6 text-center text-sm text-gray-500">
              No billing entities yet.
            </div>
          ) : (
            <div className="space-y-4">
              {entities.map((entity) => (
                <div key={entity.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs uppercase text-gray-500">{entity.type}</div>
                      <div className="text-base font-semibold text-gray-900">{entity.name}</div>
                      {entity.contractorId && contractorMap.get(entity.contractorId) && (
                        <div className="text-sm text-gray-600">
                          Linked contractor: {contractorMap.get(entity.contractorId)?.name}
                        </div>
                      )}
                      <div className="text-sm text-gray-600">
                        {entity.addressLine1}
                        {entity.addressLine2 ? `, ${entity.addressLine2}` : ""}
                      </div>
                      <div className="text-sm text-gray-600">
                        {entity.postalCode} {entity.city}, {entity.country}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">IBAN: {entity.iban}</div>
                      <div className="text-sm text-gray-600">VAT: {entity.vatNumber || "—"}</div>
                      <div className="text-sm text-gray-600">
                        Default VAT rate: {entity.defaultVatRate}% · Next sequence: {entity.nextInvoiceSequence}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => startEdit(entity)}
                        className="px-3 py-1.5 rounded border border-gray-300 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(entity.id)}
                        className="px-3 py-1.5 rounded border border-red-200 text-sm text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
