import { useEffect, useState } from "react";

/**
 * Tenant Form (Slice 4)
 * - Phone-based tenant identity
 * - Unit + appliance context
 * - Plain JS (NO TypeScript generics)
 */



export default function TenantForm() {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "http://127.0.0.1:3001";

  const [phone, setPhone] = useState("");
  const [tenant, setTenant] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [appliances, setAppliances] = useState([]);
  const [buildingId, setBuildingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [applianceId, setApplianceId] = useState("");
  const [category, setCategory] = useState("oven");
  const [description, setDescription] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [notice, setNotice] = useState(null); // { type: "ok" | "err", msg: string }
  const [loadingTenant, setLoadingTenant] = useState(false);

  function ok(msg) {
    setNotice({ type: "ok", msg });
    setTimeout(() => setNotice(null), 4000);
  }
  function err(msg) {
    setNotice({ type: "err", msg });
  }
  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const msg =
        parsed?.error?.message ||
        parsed?.message ||
        `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return parsed?.data;
  }
  async function lookupTenant() {
    const p = phone.trim();
    if (!p) return;
    setLoadingTenant(true);
    try {
      const found = await api(`/tenants?phone=${encodeURIComponent(p)}`);
      if (found) {
        setTenant(found);
        ok("Tenant identified by phone.");
      } else {
        setTenant(null);
        err("No tenant found for this phone.");
      }
    } catch (e) {
      setTenant(null);
      err(`Lookup failed: ${e.message}`);
    } finally {
      setLoadingTenant(false);
    }
  }
  async function createTenant() {
    const p = phone.trim();
    if (!p) return err("Phone is required.");
    setLoadingTenant(true);
    try {
      const created = await api(`/tenants`, {
        method: "POST",
        body: JSON.stringify({ phone: p }),
      });
      setTenant(created);
      ok("Tenant created (or found).");
    } catch (e) {
      err(`Create tenant failed: ${e.message}`);
    } finally {
      setLoadingTenant(false);
    }
  }
  useEffect(() => {
    api(`/buildings`)
      .then((rows) => setBuildings(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!buildingId) {
      setUnits([]);
      setUnitId("");
      setAppliances([]);
      setApplianceId("");
      return;
    }
    api(`/buildings/${buildingId}/units`)
      .then((rows) => setUnits(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, [buildingId]);
  useEffect(() => {
    if (!unitId) {
      setAppliances([]);
      setApplianceId("");
      return;
    }
    api(`/units/${unitId}/appliances`)
      .then((rows) => setAppliances(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, [unitId]);
  async function submitRequest(e) {
    e.preventDefault();
    if (!description.trim()) return err("Description is required.");
    const cost = String(estimatedCost).trim();
    const costNum = cost ? Number(cost) : null;
    try {
      const payload = {
        description,
        category,
        contactPhone: phone.trim() || undefined,
        estimatedCost: Number.isFinite(costNum) ? costNum : undefined,
        tenantId: tenant?.id || undefined,
        unitId: unitId || tenant?.unitId || undefined,
        applianceId: applianceId || undefined,
      };
      const created = await api(`/requests`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      ok(`Request created with status: ${created?.status || "OK"}`);
      setDescription("");
      setEstimatedCost("");
    } catch (e2) {
      err(`Create request failed: ${e2.message}`);
    }
  }
  const tenantUnitLabel = tenant?.unit?.unitNumber
    ? tenant.unit.unitNumber
    : tenant?.unitId
    ? tenant.unitId
    : "\u2014";
  return (
    <div className="main-container">
      <h1>Tenant request (by phone)</h1>
      <div className="subtle">
        Backend: <code className="code">{API_BASE}</code>
      </div>
      {notice ? (
        <div className={`notice ${notice.type === "ok" ? "notice-ok" : "notice-err"}`}>
          {notice.msg}
        </div>
      ) : null}
      <div className="card">
        <label className="label">Phone number</label>
        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={lookupTenant}
          placeholder="+41 79 123 45 67"
        />
        <div className="row">
          <button
            type="button"
            className="button-secondary"
            onClick={lookupTenant}
            disabled={loadingTenant || !phone.trim()}
          >
            {loadingTenant ? "Looking up\u2026" : "Lookup"}
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={createTenant}
            disabled={loadingTenant || !phone.trim()}
          >
            {loadingTenant ? "Working\u2026" : tenant ? "Re-create / Find" : "Create tenant"}
          </button>
        </div>
        <div className="help">
          {tenant ? (
            <>
              Tenant ID: <code className="code-small">{tenant.id}</code> \u2022 Phone:{" "}
              <strong>{tenant.phone || phone}</strong> \u2022 Unit:{" "}
              <strong>{tenantUnitLabel}</strong>
            </>
          ) : (
            <>No tenant loaded yet. Enter phone \u2192 Lookup, or Create.</>
          )}
        </div>
      </div>
      <form onSubmit={submitRequest} className="card">
        <h2>Request context</h2>
        <label className="label">Building</label>
        <select
          className="input"
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
        >
          <option value="">Select\u2026</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <label className="label">Unit</label>
        <select
          className="input"
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          disabled={!buildingId}
        >
          <option value="">{buildingId ? "Select\u2026" : "Select building first"}</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unitNumber ? `Unit ${u.unitNumber}${u.floor ? ` (floor ${u.floor})` : ""}` : u.id}
            </option>
          ))}
        </select>
        <label className="label">Appliance</label>
        <select
          className="input"
          value={applianceId}
          onChange={(e) => setApplianceId(e.target.value)}
          disabled={!unitId}
        >
          <option value="">{unitId ? "Select\u2026" : "Select unit first"}</option>
          {appliances.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.serial ? ` (${a.serial})` : ""}
            </option>
          ))}
        </select>
        <label className="label">Category</label>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {["stove", "oven", "dishwasher", "bathroom", "lighting"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="label">Description</label>
        <textarea
          className="input textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue\u2026"
        />
        <label className="label">Estimated cost (CHF)</label>
        <input
          className="input"
          type="number"
          value={estimatedCost}
          onChange={(e) => setEstimatedCost(e.target.value)}
          placeholder="e.g. 150"
        />
        <button className="button-primary" type="submit">
          Submit request
        </button>
        <div className="help">
          This will include: tenantId ({tenant?.id ? "yes" : "no"}), unitId (
          {unitId || tenant?.unitId ? "yes" : "no"}), applianceId ({applianceId ? "yes" : "no"}).
        </div>
      </form>
    </div>
  );
}
