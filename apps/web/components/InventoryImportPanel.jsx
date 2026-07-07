/**
 * InventoryImportPanel
 *
 * Bulk-import buildings or units from a CSV, behind a review gate:
 *   pick entity type → upload CSV → preview valid/error rows → commit.
 *
 * Mirrors the finance/Imports pattern but targets the Building/Unit tables.
 * Uploads go through /api/imports/inventory (bodyParser-disabled proxy).
 */

import { useState, useRef, useCallback, useEffect } from "react";
import Panel from "./layout/Panel";
import Badge from "./ui/Badge";
import { authHeaders } from "../lib/api";
import { formatDate } from "../lib/format";
import { cn } from "../lib/utils";

const ENTITY_OPTIONS = [
  { value: "BUILDING", label: "Buildings", template: "/templates/buildings.csv" },
  { value: "UNIT", label: "Units", template: "/templates/units.csv" },
];

function rowStatusVariant(status) {
  switch (status) {
    case "VALID": return "info";
    case "COMMITTED": return "success";
    case "ERROR": return "destructive";
    default: return "default";
  }
}

function batchStatusVariant(status) {
  switch (status) {
    case "PENDING_REVIEW": return "warning";
    case "COMMITTED": return "success";
    case "REJECTED": return "destructive";
    default: return "default";
  }
}

/** Short human summary of a row's payload for the preview table. */
function rowSummary(entityType, data) {
  if (!data) return "—";
  if (entityType === "BUILDING") {
    return [data.name, data.address].filter(Boolean).join(" · ") || "—";
  }
  return [data.unitNumber && `Unit ${data.unitNumber}`, data.buildingRef && `→ ${data.buildingRef}`]
    .filter(Boolean)
    .join(" ") || "—";
}

export default function InventoryImportPanel({ onCommitted }) {
  const [entityType, setEntityType] = useState("BUILDING");
  const [file, setFile] = useState(null);
  const [batch, setBatch] = useState(null);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);
  const fileRef = useRef(null);

  const activeTemplate = ENTITY_OPTIONS.find((o) => o.value === entityType)?.template;

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/imports/inventory?limit=5", { headers: authHeaders() });
      const json = await res.json().catch(() => null);
      if (res.ok && json) setRecent(json.data ?? []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  function reset() {
    setFile(null);
    setBatch(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);
    setBatch(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("entityType", entityType);
      const res = await fetch("/api/imports/inventory", {
        method: "POST",
        headers: authHeaders(), // no Content-Type — browser sets the multipart boundary
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Upload failed");
      setBatch(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setUploading(false);
    }
  }

  async function handleCommit() {
    if (!batch) return;
    setCommitting(true);
    setError("");
    try {
      const res = await fetch(`/api/imports/inventory/${batch.id}/commit`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Commit failed");
      setResult(json.data);
      setBatch(json.data.batch);
      loadRecent();
      onCommitted?.();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setCommitting(false);
    }
  }

  const isCommitted = batch?.status === "COMMITTED";
  const canCommit = batch && batch.status === "PENDING_REVIEW" && batch.validCount > 0;

  return (
    <Panel title="Import from CSV">
      {/* Controls */}
      <form onSubmit={handleUpload} className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Entity type */}
          <div>
            <label className="form-label">Import type</label>
            <select
              className="form-input"
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); reset(); }}
            >
              {ENTITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* File */}
          <div>
            <label className="form-label">CSV file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="form-input"
              onChange={(e) => setFile(e.target.files[0] || null)}
              aria-label="CSV file"
            />
          </div>

          <button type="submit" className="button-primary text-sm" disabled={!file || uploading}>
            {uploading ? "Validating…" : "Upload & preview"}
          </button>
          {(batch || result) && (
            <button type="button" className="button-secondary text-sm" onClick={reset} disabled={uploading || committing}>
              Clear
            </button>
          )}
        </div>

        <p className="text-xs text-muted">
          Need the format?{" "}
          <a href={activeTemplate} download className="text-brand-dark underline">
            Download the {entityType === "BUILDING" ? "buildings" : "units"} template
          </a>
          . Amounts in CHF. For units, <code>buildingRef</code> is the building id, name, or address.
        </p>
      </form>

      {error && <div className="notice notice-err mt-4">{error}</div>}

      {/* Commit result banner */}
      {result && (
        <div className="notice notice-ok mt-4">
          Committed {result.committed} {entityType === "BUILDING" ? "building(s)" : "unit(s)"}
          {result.errors > 0 ? ` · ${result.errors} row(s) failed — see below` : ""}.
        </div>
      )}

      {/* Preview */}
      {batch && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-foreground">{batch.fileName}</span>
            <Badge variant={batchStatusVariant(batch.status)}>{batch.status.replace(/_/g, " ")}</Badge>
            <span className="text-xs text-muted">
              {batch.rowCount} row{batch.rowCount !== 1 ? "s" : ""} ·{" "}
              <span className="text-success-text">{batch.validCount} valid</span>
              {batch.errorCount > 0 && <> · <span className="text-destructive-text">{batch.errorCount} error{batch.errorCount !== 1 ? "s" : ""}</span></>}
            </span>
            <div className="flex-1" />
            {!isCommitted && (
              <button
                type="button"
                className="button-primary text-sm"
                onClick={handleCommit}
                disabled={!canCommit || committing}
                title={!canCommit ? "No valid rows to commit" : "Create records for all valid rows"}
              >
                {committing ? "Committing…" : `Commit ${batch.validCount} valid row${batch.validCount !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {batch.rows.map((r) => (
              <div key={r.id} className="border border-table-border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">Row {r.rowIndex}</span>
                  <Badge variant={rowStatusVariant(r.status)}>{r.status}</Badge>
                </div>
                <p className="text-sm text-foreground mt-1">{rowSummary(batch.entityType, r.data)}</p>
                {r.errorMessage && <p className="text-xs text-destructive-text mt-1">{r.errorMessage}</p>}
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="inline-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {batch.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.rowIndex}</td>
                    <td><Badge variant={rowStatusVariant(r.status)}>{r.status}</Badge></td>
                    <td>{rowSummary(batch.entityType, r.data)}</td>
                    <td className="text-xs text-destructive-text">{r.errorMessage || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent imports */}
      {recent.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-foreground-dim uppercase tracking-wide mb-2">Recent imports</h3>
          <ul className="divide-y divide-table-divider">
            {recent.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="text-foreground truncate">{b.fileName}</span>
                <Badge variant="default">{b.entityType}</Badge>
                <Badge variant={batchStatusVariant(b.status)}>{b.status.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-muted">{b.validCount} valid{b.errorCount ? ` · ${b.errorCount} err` : ""}</span>
                <div className="flex-1" />
                <span className="text-xs text-muted">{formatDate(b.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
