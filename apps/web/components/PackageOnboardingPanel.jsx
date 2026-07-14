/**
 * PackageOnboardingPanel
 *
 * Drop a régie's whole year-end package (balance sheet, income statement, rent
 * roll, general ledger — any combination). Analyze detects what each file is and
 * cross-checks them (rent-roll net × 12 vs income-statement rental income;
 * ledger totals vs the income statement; balance-sheet Actif = Passif). Commit
 * routes each file to its onboarder in order (rent roll → ledger → statements).
 */

import { useState, useRef } from "react";
import Panel from "./layout/Panel";
import Badge from "./ui/Badge";
import { authHeaders } from "../lib/api";
import { cn } from "../lib/utils";

const fmtChf = (n) => (n == null ? "—" : `CHF ${Number(n).toLocaleString("de-CH", { maximumFractionDigits: 2 })}`);

const TYPE_LABEL = {
  RENT_ROLL: "Rent roll",
  GENERAL_LEDGER: "General ledger",
  BALANCE_SHEET: "Balance sheet",
  INCOME_STATEMENT: "Income statement",
  GENERAL_INFO: "General info",
  UNKNOWN: "Unrecognised",
};
const TYPE_VARIANT = {
  RENT_ROLL: "info",
  GENERAL_LEDGER: "info",
  BALANCE_SHEET: "default",
  INCOME_STATEMENT: "default",
  GENERAL_INFO: "brand",
  UNKNOWN: "warning",
};

// buildingId present → hydrate that building. Absent → "new building" mode:
// extract the building's identity from the package and create it on commit.
export default function PackageOnboardingPanel({ buildingId, onClose, onCommitted, onCreated }) {
  const newMode = !buildingId;
  const [files, setFiles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billingMode, setBillingMode] = useState("snapshot");
  const [fiscalYear, setFiscalYear] = useState("");
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);
  const [b, setB] = useState({ name: "", address: "", city: "", postalCode: "" }); // new-mode building fields
  const fileRef = useRef(null);

  function addFiles(list) {
    const next = Array.from(list || []);
    if (next.length) setFiles((prev) => [...prev, ...next]);
  }

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!files.length) return;
    setLoading(true);
    setError("");
    setAnalysis(null);
    setResult(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("file", f));
      const url = newMode ? `/api/onboarding/package/analyze` : `/api/buildings/${buildingId}/onboarding/package/analyze`;
      const res = await fetch(url, { method: "POST", headers: authHeaders(), body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Analysis failed");
      setAnalysis(json.data);
      setFiscalYear(String(json.data.fiscalYear || ""));
      const eb = json.data.extractedBuilding;
      if (newMode && eb) setB({ name: eb.name || "", address: eb.address || "", city: eb.city || "", postalCode: eb.postalCode || "" });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!files.length) return;
    if (newMode && !(b.name.trim() || b.address.trim())) { setError("Enter the building's address before importing."); return; }
    const confirmMsg = newMode
      ? `Create "${b.name || b.address}" and import this package for fiscal year ${fiscalYear}?`
      : `Commit this package to the building for fiscal year ${fiscalYear}? Units, tenants, leases and invoices are created; the balance sheet and income statement are sent to review.`;
    if (!window.confirm(confirmMsg)) return;
    setCommitting(true);
    setError("");
    try {
      // New mode: create the building from the (confirmed) extracted fields first.
      let targetId = buildingId;
      if (newMode) {
        const cRes = await fetch("/api/buildings", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ name: b.name.trim() || b.address.trim(), address: b.address.trim() || b.name.trim(), city: b.city.trim() || undefined, postalCode: b.postalCode.trim() || undefined }),
        });
        const cJson = await cRes.json();
        if (!cRes.ok) throw new Error(cJson?.error?.message || "Failed to create building");
        targetId = cJson.data.id;
      }
      const form = new FormData();
      files.forEach((f) => form.append("file", f));
      form.append("billingMode", billingMode);
      form.append("fiscalYear", fiscalYear);
      const res = await fetch(`/api/buildings/${targetId}/onboarding/package/commit`, { method: "POST", headers: authHeaders(), body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Commit failed");
      setResult(json.data);
      if (newMode) onCreated?.(targetId); else onCommitted?.();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setCommitting(false);
    }
  }

  const usable = analysis?.documents?.filter((d) => d.type !== "UNKNOWN").length ?? 0;

  return (
    <Panel
      title={newMode ? "Import a new building from a régie package" : "Import data from a régie package"}
      actions={onClose ? <button className="button-secondary text-sm" onClick={onClose}>Close</button> : null}
    >
      <form onSubmit={handleAnalyze} className="space-y-3">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            files.length ? "border-brand-ring bg-brand-light" : "border-muted-ring hover:border-brand-ring",
          )}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".csv,text/csv,.tsv,text/tab-separated-values"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
            aria-label="Package CSVs"
          />
          {files.length ? (
            <p className="text-sm text-brand-dark font-medium">{files.length} file(s) selected</p>
          ) : (
            <p className="text-sm text-muted">Drop the whole year-end package here (balance sheet, income statement, rent roll, general ledger)</p>
          )}
        </div>

        {files.length > 0 && (
          <ul className="space-y-1 text-xs">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                <span className="truncate text-muted">{f.name}</span>
                <button type="button" className="text-muted-dark hover:text-foreground" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>remove</button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" className="button-primary text-sm" disabled={!files.length || loading}>
            {loading ? "Analyzing…" : "Analyze package"}
          </button>
          {files.length > 0 && (
            <button type="button" className="button-secondary text-sm" onClick={() => { setFiles([]); setAnalysis(null); setResult(null); if (fileRef.current) fileRef.current.value = ""; }}>Clear</button>
          )}
        </div>
        <p className="text-xs text-muted">Nothing is created yet — this detects each file and checks the documents tie out.</p>
      </form>

      {error && <div className="notice notice-err mt-4">{error}</div>}

      {analysis && (
        <div className="mt-4 space-y-4">
          {/* Document inventory */}
          <div className="overflow-x-auto">
            <table className="inline-table">
              <thead><tr><th>File</th><th>Detected as</th><th>Details</th></tr></thead>
              <tbody>
                {analysis.documents.map((d, i) => (
                  <tr key={`${d.fileName}-${i}`}>
                    <td className="font-mono text-xs">{d.fileName}</td>
                    <td><Badge variant={TYPE_VARIANT[d.type]}>{TYPE_LABEL[d.type]}</Badge></td>
                    <td className="text-xs text-muted">{d.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reconciliation */}
          {analysis.reconciliation.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Cross-document checks</p>
              {analysis.reconciliation.map((c, i) => (
                <div key={i} className={cn("rounded-lg border p-3 text-sm", c.ok ? "border-success-ring bg-success-light" : "border-warning-ring bg-warning-light")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{c.ok ? "✓" : "⚠"} {c.label}</span>
                    <span className="text-xs tabular-nums">{fmtChf(c.actualChf)} vs {fmtChf(c.expectedChf)}{c.deltaChf !== 0 ? ` (Δ ${fmtChf(c.deltaChf)})` : ""}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{c.note}</p>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {analysis.warnings.length > 0 && (
            <div className="rounded-lg border border-warning-ring bg-warning-light p-3 text-sm text-warning-text">
              <p className="font-medium mb-1">⚠ {analysis.warnings.length} note(s)</p>
              <ul className="list-disc pl-5 space-y-0.5">{analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}

          {/* Commit */}
          {!result && usable > 0 && (
            <div className="rounded-lg border border-surface-border p-4 space-y-3">
              {newMode && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Building {analysis.extractedBuilding ? <span className="font-normal text-muted">— detected from the package, edit if needed</span> : <span className="font-normal text-muted">— not detected, enter it</span>}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <input className="filter-input sm:col-span-2" placeholder="Address" value={b.address} onChange={(e) => setB((s) => ({ ...s, address: e.target.value }))} />
                    <input className="filter-input" placeholder="Postal code" value={b.postalCode} onChange={(e) => setB((s) => ({ ...s, postalCode: e.target.value }))} />
                    <input className="filter-input" placeholder="City" value={b.city} onChange={(e) => setB((s) => ({ ...s, city: e.target.value }))} />
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-foreground">Fiscal year
                  <input type="number" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className="ml-2 w-24 rounded-md border border-surface-border bg-surface px-2 py-1 text-sm" min="2000" max="2100" />
                </label>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="radio" name="pkgBilling" checked={billingMode === "snapshot"} onChange={() => setBillingMode("snapshot")} className="mt-0.5" />
                  <span><b>Snapshot / reference-only</b> — create records; leases stay draft, no billing. Reporting uses the imported statements.</span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="radio" name="pkgBilling" checked={billingMode === "activate"} onChange={() => setBillingMode("activate")} className="mt-0.5" />
                  <span><b>Activate for ongoing management</b> — leases become active and start recurring billing from the current period.</span>
                </label>
              </div>
              <button className="button-primary text-sm" onClick={handleCommit} disabled={committing || !fiscalYear || (newMode && !(b.name.trim() || b.address.trim()))}>
                {committing ? (newMode ? "Creating…" : "Committing…") : newMode ? `Create building & import — ${usable} document(s)` : `Commit package — ${usable} document(s)`}
              </button>
              <p className="text-xs text-muted">Rent roll → units/tenants/leases · general ledger → contractor invoices · balance sheet + income statement → sent to Finance → Imports for review.</p>
              {error && <div className="notice notice-err text-sm">{error}</div>}
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 space-y-2">
          <div className="notice notice-ok text-sm">Package committed for fiscal year <b>{result.fiscalYear}</b>.</div>
          <div className="overflow-x-auto">
            <table className="inline-table">
              <thead><tr><th>File</th><th>Type</th><th>Result</th></tr></thead>
              <tbody>
                {result.results.map((r, i) => (
                  <tr key={`${r.fileName}-${i}`}>
                    <td className="font-mono text-xs">{r.fileName}</td>
                    <td><Badge variant={TYPE_VARIANT[r.type]}>{TYPE_LABEL[r.type]}</Badge></td>
                    <td className="text-xs">{r.outcome}{r.detail && r.detail !== "ok" ? ` — ${r.detail}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.warnings.length > 0 && (
            <div className="rounded-lg border border-warning-ring bg-warning-light p-3 text-sm text-warning-text">
              <ul className="list-disc pl-5 space-y-0.5">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
