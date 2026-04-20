import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../components/AppShell";
import { ALLOWED_CATEGORIES } from "../lib/categories";

import { cn } from "../lib/utils";
/**
 * Tenant Form (Slice 4)
 * - Phone-based tenant identity
 * - Unit + asset context (legacy: appliance)
 * - Plain JS (NO TypeScript generics)
 */



export default function TenantForm() {
  const API_PROXY = "/api";

  const [phone, setPhone] = useState("");
  const [tenant, setTenant] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [assets, setAssets] = useState([]);
  const [buildingId, setBuildingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [category, setCategory] = useState(ALLOWED_CATEGORIES[0] || "oven");
  const [description, setDescription] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [notice, setNotice] = useState(null); // { type: "ok" | "err", msg: string }
  const [loadingTenant, setLoadingTenant] = useState(false);
  const [apiBase, setApiBase] = useState("");

  useEffect(() => {
    setApiBase(
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://127.0.0.1:3001"
    );
  }, []);

  function ok(msg) {
    setNotice({ type: "ok", msg });
    setTimeout(() => setNotice(null), 4000);
  }
  function err(msg) {
    setNotice({ type: "err", msg });
  }
  async function applyTenantContext(found) {
    if (!found) return;
    if (found.unit?.buildingId) {
      setBuildingId(found.unit.buildingId);
      setUnitId(found.unit.id);
      return;
    }
    if (found.unitId) {
      try {
        const unit = await api(`/units/${found.unitId}`);
        if (unit?.buildingId) {
          setBuildingId(unit.buildingId);
          setUnitId(found.unitId);
        }
      } catch {
        // ignore lookup failure; user can still select manually
      }
    }
  }
  async function api(path, options = {}) {
    const res = await fetch(`${API_PROXY}${path}`, {
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
        await applyTenantContext(found);
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
      await applyTenantContext(created);
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
      setAssets([]);
      setAssetId("");
      return;
    }
    api(`/buildings/${buildingId}/units`)
      .then((rows) => setUnits(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, [buildingId]);
  useEffect(() => {
    if (!unitId) {
      setAssets([]);
      setAssetId("");
      return;
    }
    api(`/units/${unitId}/assets`)
      .then((rows) => setAssets(Array.isArray(rows) ? rows : []))
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
        assetId: assetId || undefined,
      };
      const created = await api(`/requests`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const reqId = created?.id ? created.id.slice(0, 8) : null;
      ok(
        <>
          Request {reqId ? <strong>#{reqId}</strong> : ""} created with status: <strong>{created?.status || "OK"}</strong>.
          {" "}
          <Link href="/tenant" className="text-inherit font-semibold">View your requests →</Link>
        </>
      );
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
    <AppShell role="TENANT">
      <div className="main-container">
      <h1>Tenant request (by phone)</h1>
      <div className="subtle">
        Backend: <code className="code">{apiBase || "\u2026"}</code>
      </div>
      {notice ? (
        <div className={cn("notice", notice.type === "ok" ? "notice-ok" : "notice-err")}>
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
          disabled={!!tenant?.unitId}
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
          disabled={!!tenant?.unitId || !buildingId}
        >
          <option value="">{buildingId ? "Select\u2026" : "Select building first"}</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unitNumber ? `Unit ${u.unitNumber}${u.floor ? ` (floor ${u.floor})` : ""}` : u.id}
            </option>
          ))}
        </select>
        <label className="label">Asset</label>
        <select
          className="input"
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          disabled={!unitId}
        >
          <option value="">{unitId ? "Select\u2026" : "Select unit first"}</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.serialNumber ? ` (${a.serialNumber})` : ""}
            </option>
          ))}
        </select>
        <label className="label">Category</label>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {ALLOWED_CATEGORIES.map((c) => (
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
          {unitId || tenant?.unitId ? "yes" : "no"}), assetId ({assetId ? "yes" : "no"}).
        </div>
      </form>
      </div>
    </AppShell>
  );
}
