/**
 * LedgerInvoiceOnboardingPanel
 *
 * Upload a régie general ledger (grand livre) for a building and import its
 * discrete third-party contractor invoices. Preview lists the invoices that
 * would be created (attributed to the building, and to a unit where the ledger
 * row is unit-scoped); commit creates each INCOMING invoice, issues it at its
 * historical date and posts the accrual to the ledger so it feeds the building's
 * NOI. Idempotent — re-running skips piece numbers already imported.
 */

import { useState, useRef } from "react";
import Panel from "./layout/Panel";
import Badge from "./ui/Badge";
import { authHeaders } from "../lib/api";
import { formatDate } from "../lib/format";
import { cn } from "../lib/utils";

const fmtChf = (n) => (n == null ? "—" : `CHF ${Number(n).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export default function LedgerInvoiceOnboardingPanel({ buildingId, onClose, onCommitted }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);
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
      const res = await fetch(`/api/buildings/${buildingId}/onboarding/invoices/preview`, {
        method: "POST",
        headers: authHeaders(), // no Content-Type — browser sets the multipart boundary
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Preview failed");
      setPreview(json.data);
      setResult(null);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!file) return;
    const n = preview?.summary?.newInvoices ?? 0;
    if (!window.confirm(`Create ${n} contractor invoice(s) for this building and post them to the ledger? This cannot be undone.`)) return;
    setCommitting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/buildings/${buildingId}/onboarding/invoices/commit`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Commit failed");
      setResult(json.data);
      onCommitted?.();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setCommitting(false);
    }
  }

  const s = preview?.summary;
  const committed = !!result;

  return (
    <Panel
      title="Onboard invoices from general ledger"
      actions={onClose ? <button className="button-secondary text-sm" onClick={onClose}>Close</button> : null}
    >
      <form onSubmit={handlePreview} className="space-y-3">
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
            aria-label="General-ledger CSV"
          />
          {file ? (
            <p className="text-sm text-brand-dark font-medium">{file.name}</p>
          ) : (
            <p className="text-sm text-muted">Drop a general-ledger (grand livre) CSV here, or click to select</p>
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
          Columns like <code>compte</code>, <code>libelle_compte</code>, <code>date_valeur</code>,{" "}
          <code>no_piece</code>, <code>texte_ecriture</code>, <code>montant_chf</code>. Only discrete
          third-party contractor invoices are imported — rent, management fees, bank charges and
          rounding are skipped. Nothing is created yet — this is a preview.
        </p>
      </form>

      {error && <div className="notice notice-err mt-4">{error}</div>}

      {preview && (
        <div className="mt-4 space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><span className="text-muted">Invoices:</span> <b>{s.total}</b></span>
            <span><span className="text-muted">New:</span> <b>{s.newInvoices}</b></span>
            {s.alreadyImported > 0 && (
              <span><span className="text-muted">Already imported:</span> <b>{s.alreadyImported}</b></span>
            )}
            <span><span className="text-muted">Unit-attributed:</span> <b>{s.unitAttributed}</b></span>
            <span><span className="text-muted">Total:</span> <b>{fmtChf(s.totalChf)}</b></span>
          </div>

          {/* Per-account rollup */}
          {s.byAccount?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {s.byAccount.map((a) => (
                <span key={a.compte} className="rounded-md border border-surface-border px-2 py-1 text-xs text-muted">
                  <span className="font-mono">{a.compte}</span> {a.accountName} · <b className="text-foreground">{a.count}</b> · {fmtChf(a.totalChf)}
                </span>
              ))}
            </div>
          )}

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="rounded-lg border border-warning-ring bg-warning-light p-3 text-sm text-warning-text">
              <p className="font-medium mb-1">⚠ {preview.warnings.length} warning(s)</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Invoices table */}
          <div className="overflow-x-auto">
            <table className="inline-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Description</th>
                  <th>Account</th>
                  <th>Unit</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.invoices.map((inv) => (
                  <tr key={inv.noPiece} className={inv.alreadyImported ? "opacity-50" : ""}>
                    <td className="text-xs whitespace-nowrap">{inv.date ? formatDate(inv.date) : "—"}</td>
                    <td>{inv.vendorName}</td>
                    <td className="text-xs text-muted max-w-xs truncate" title={inv.description}>{inv.description}</td>
                    <td className="font-mono text-xs">{inv.compte}</td>
                    <td>
                      {inv.matchedUnitNumber
                        ? <Badge variant="info">{inv.matchedUnitNumber}</Badge>
                        : inv.unitNumber
                          ? <Badge variant="warning">{inv.unitNumber}?</Badge>
                          : <span className="text-muted text-xs">Building</span>}
                    </td>
                    <td className="text-right whitespace-nowrap">{fmtChf(inv.amountChf)}</td>
                    <td>
                      {inv.alreadyImported
                        ? <Badge variant="default">imported</Badge>
                        : <Badge variant="success">new</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Commit */}
          {!committed && s.newInvoices > 0 && (
            <div className="rounded-lg border border-surface-border p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Import these invoices?</p>
              <p className="text-sm text-muted">
                Each becomes an INCOMING invoice attributed to the building (and unit where known),
                classified by its régie account code, and posted to the ledger at its historical date
                so it feeds building NOI. Years covered by an imported income statement keep using
                that statement (no double-count).
              </p>
              <button className="button-primary text-sm" onClick={handleCommit} disabled={committing}>
                {committing ? "Importing…" : `Import ${s.newInvoices} invoice(s) — ${fmtChf(s.totalChf)}`}
              </button>
              {error && <div className="notice notice-err text-sm">{error}</div>}
            </div>
          )}
          {!committed && s.newInvoices === 0 && s.total > 0 && (
            <div className="notice text-sm">All invoices in this ledger were already imported.</div>
          )}
        </div>
      )}

      {/* Commit result */}
      {result && (
        <div className="mt-4 space-y-2">
          <div className="notice notice-ok text-sm">
            Imported <b>{result.created}</b> invoice(s), <b>{result.posted}</b> posted to the ledger.
            {result.skippedAlreadyImported > 0 && <> <b>{result.skippedAlreadyImported}</b> already existed and were skipped.</>}
          </div>
          {result.errors.length > 0 && (
            <div className="rounded-lg border border-warning-ring bg-warning-light p-3 text-sm text-warning-text">
              <p className="font-medium mb-1">⚠ {result.errors.length} issue(s)</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {result.errors.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
