/**
 * RentRollOnboardingPanel
 *
 * Upload a régie rent roll for a building and preview the Units / Tenants /
 * Leases that would be created. Preview only (no writes) — the commit step
 * (create + optional billing) lands in a follow-up.
 */

import { useState, useRef } from "react";
import Panel from "./layout/Panel";
import Badge from "./ui/Badge";
import { authHeaders } from "../lib/api";
import { formatDate } from "../lib/format";
import { cn } from "../lib/utils";

const fmtChf = (n) => (n == null ? "—" : `CHF ${Number(n).toLocaleString("de-CH")}`);

export default function RentRollOnboardingPanel({ buildingId, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  async function handlePreview(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/buildings/${buildingId}/onboarding/preview`, {
        method: "POST",
        headers: authHeaders(), // no Content-Type — browser sets the multipart boundary
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Preview failed");
      setPreview(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const s = preview?.summary;

  return (
    <Panel
      title="Onboard from rent roll"
      actions={
        onClose ? (
          <button className="button-secondary text-sm" onClick={onClose}>Close</button>
        ) : null
      }
    >
      <form onSubmit={handlePreview} className="space-y-3">
        {/* Drop zone */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            file ? "border-brand-ring bg-brand-light" : "border-muted-ring hover:border-brand-ring",
          )}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files[0];
            if (dropped) setFile(dropped);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,.tsv,text/tab-separated-values"
            className="hidden"
            onChange={(e) => setFile(e.target.files[0] || null)}
            aria-label="Rent-roll CSV"
          />
          {file ? (
            <p className="text-sm text-brand-dark font-medium">{file.name}</p>
          ) : (
            <p className="text-sm text-muted">Drop a rent-roll CSV here, or click to select</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="button-primary text-sm" disabled={!file || loading}>
            {loading ? "Reading…" : "Preview"}
          </button>
          {file && (
            <button
              type="button"
              className="button-secondary text-sm"
              onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
            >
              Clear
            </button>
          )}
        </div>

        <p className="text-xs text-muted">
          Columns like <code>objet</code>, <code>locataire_principal</code>, <code>type_objet</code>,{" "}
          <code>entree</code>/<code>sortie</code>, <code>loyer_net_mensuel_chf</code>. One row per object
          (apartment or garage). Nothing is created yet — this is a preview.
        </p>
      </form>

      {error && <div className="notice notice-err mt-4">{error}</div>}

      {preview && (
        <div className="mt-4 space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><span className="text-muted">Objects:</span> <b>{s.totalObjects}</b></span>
            <span><span className="text-muted">Apartments:</span> <b>{s.apartments}</b></span>
            <span><span className="text-muted">Garages:</span> <b>{s.garages}</b></span>
            <span><span className="text-muted">Vacant:</span> <b>{s.vacant}</b></span>
            <span><span className="text-muted">Tenants:</span> <b>{s.tenants}</b></span>
            <span><span className="text-muted">Leases:</span> <b>{s.leases}</b></span>
            <span><span className="text-muted">Annual net rent:</span> <b>{fmtChf(s.annualNetRentChf)}</b></span>
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="rounded-lg border border-warning-ring bg-warning-light p-3 text-sm text-warning-text">
              <p className="font-medium mb-1">⚠ {preview.warnings.length} warning(s)</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Units table */}
          <div className="overflow-x-auto">
            <table className="inline-table">
              <thead>
                <tr>
                  <th>Object</th>
                  <th>Type</th>
                  <th>Tenant</th>
                  <th>Start</th>
                  <th>Net rent</th>
                  <th>Linked flat</th>
                  <th>Lease</th>
                </tr>
              </thead>
              <tbody>
                {preview.units.map((u) => (
                  <tr key={u.objet}>
                    <td className="font-mono text-xs">{u.objet}</td>
                    <td>
                      <Badge variant={u.unitType === "PARKING" ? "default" : "info"}>
                        {u.unitType === "PARKING" ? (u.parkingKind || "PARKING") : "APARTMENT"}
                      </Badge>
                    </td>
                    <td>{u.isVacant ? <span className="text-muted">Vacant</span> : u.tenantName}</td>
                    <td className="text-xs">{u.startDate ? formatDate(u.startDate) : "—"}</td>
                    <td>{fmtChf(u.netRentChf)}</td>
                    <td className="font-mono text-xs text-muted">{u.linkedApartmentObjet || "—"}</td>
                    <td>{u.willCreateLease ? <Badge variant="success">Lease</Badge> : <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}
