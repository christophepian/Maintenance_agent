import { useState, useEffect, useCallback } from "react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

/* ── Constants ─────────────────────────────────────────────── */

const SOURCE_TYPE_LABELS = {
  INVOICE_ISSUED: "Invoice issued",
  INVOICE_PAID:   "Invoice paid",
  RENT_RECEIPT:   "Rent receipt",
  MANUAL:         "Manual entry",
};

const ACCOUNT_TYPE_LABELS = {
  ASSET:     "Assets",
  LIABILITY: "Liabilities",
  REVENUE:   "Revenue",
  EXPENSE:   "Expenses",
};

const ACCOUNT_TYPE_ORDER = ["ASSET", "LIABILITY", "REVENUE", "EXPENSE"];

const ACCOUNT_TYPE_CLASSES = {
  ASSET:     "bg-slate-100 text-slate-600",
  LIABILITY: "bg-red-100 text-red-700",
  REVENUE:   "bg-blue-100 text-blue-700",
  EXPENSE:   "bg-amber-100 text-amber-700",
};

const PAGE_SIZE = 50;

/* ── Helpers ────────────────────────────────────────────────── */

function last30Days() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatCHF(cents) {
  if (!cents && cents !== 0) return "—";
  return (cents / 100).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function AccountTypeBadge({ type }) {
  const cls = ACCOUNT_TYPE_CLASSES[type] || "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {ACCOUNT_TYPE_LABELS[type] || type}
    </span>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function LedgerPage() {
  // Tab: journal | trial-balance
  const [tab, setTab] = useState("journal");

  // Reference data for selects
  const [buildings, setBuildings] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // Journal state
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Trial balance state
  const [balances, setBalances] = useState([]);
  const [tbLoading, setTbLoading] = useState(false);
  const [tbError, setTbError] = useState(null);

  // Backfill / setup state
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);
  const [backfillError, setBackfillError] = useState(null);

  // Filters — default to last 30 days
  const defaults = last30Days();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [accountId, setAccountId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [sourceType, setSourceType] = useState("");

  /* ── Load reference data ─────────────────────────────────── */
  useEffect(() => {
    async function loadRefs() {
      try {
        const [bRes, aRes] = await Promise.all([
          fetch("/api/buildings?limit=100", { headers: authHeaders() }),
          fetch("/api/coa/accounts?limit=500&isActive=true", { headers: authHeaders() }),
        ]);
        const bData = await bRes.json();
        const aData = await aRes.json();
        setBuildings(bData?.data || bData || []);
        setAccounts(aData?.data || aData || []);
      } catch { /* non-critical */ }
    }
    loadRefs();
  }, []);

  /* ── Fetch journal ────────────────────────────────────────── */
  const fetchEntries = useCallback(async (newOffset = 0) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset: newOffset });
    if (from)       params.set("from", from);
    if (to)         params.set("to", to);
    if (accountId)  params.set("accountId", accountId);
    if (buildingId) params.set("buildingId", buildingId);
    if (sourceType) params.set("sourceType", sourceType);

    try {
      const res = await fetch(`/api/ledger?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load ledger");
      setEntries(json.data || []);
      setTotal(json.pagination?.total || 0);
      setOffset(newOffset);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [from, to, accountId, buildingId, sourceType]);

  /* ── Fetch trial balance ──────────────────────────────────── */
  const fetchTrialBalance = useCallback(async () => {
    setTbLoading(true);
    setTbError(null);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to)   params.set("to", to);

    try {
      const res = await fetch(`/api/ledger/trial-balance?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load trial balance");
      setBalances(json.data || []);
    } catch (e) {
      setTbError(e.message);
    } finally {
      setTbLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (tab === "journal") fetchEntries(0);
    else fetchTrialBalance();
  }, [tab, fetchEntries, fetchTrialBalance]);

  function clearFilters() {
    const d = last30Days();
    setFrom(d.from); setTo(d.to);
    setAccountId(""); setBuildingId(""); setSourceType("");
  }

  async function runBackfill({ seedCoa = true, issueDrafts = true } = {}) {
    setBackfilling(true);
    setBackfillResult(null);
    setBackfillError(null);
    try {
      const res = await fetch("/api/ledger/backfill", {
        method: "POST",
        headers: { ...authHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ seedCoa, issueDrafts }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Backfill failed");
      setBackfillResult(json.data);
      // Reload reference data + journal after successful backfill
      const [bRes, aRes] = await Promise.all([
        fetch("/api/buildings?limit=100", { headers: authHeaders() }),
        fetch("/api/coa/accounts?limit=500&isActive=true", { headers: authHeaders() }),
      ]);
      setBuildings((await bRes.json())?.data || []);
      const freshAccounts = (await aRes.json())?.data || [];
      setAccounts(freshAccounts);
      fetchEntries(0);
    } catch (e) {
      setBackfillError(e.message);
    } finally {
      setBackfilling(false);
    }
  }

  /* ── Trial balance: group by account type ─────────────────── */
  const tbByType = ACCOUNT_TYPE_ORDER.reduce((acc, type) => {
    const rows = balances.filter((b) => b.accountType === type);
    if (rows.length > 0) acc[type] = rows;
    return acc;
  }, {});

  const tbTotals = balances.reduce(
    (acc, b) => ({ debit: acc.debit + b.debitCents, credit: acc.credit + b.creditCents }),
    { debit: 0, credit: 0 },
  );
  const tbBalanced = tbTotals.debit === tbTotals.credit;

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="General Ledger"
          subtitle="Advanced audit view — double-entry journal"
        />
        <PageContent>

          {/* ── Setup banner (shown when COA not seeded) ─────── */}
          {accounts.length === 0 && !backfillResult && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-800">Chart of Accounts not set up</p>
                  <p className="text-xs text-amber-700 mt-1">
                    The ledger requires a Chart of Accounts to post entries. Click the button to seed the
                    Swiss Kontenplan and post historical invoice entries in one step.
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-sm shrink-0"
                  onClick={() => runBackfill({ seedCoa: true, issueDrafts: true })}
                  disabled={backfilling}
                >
                  {backfilling ? "Working…" : "Seed COA + Post entries"}
                </button>
              </div>
              {backfillError && (
                <p className="text-xs text-red-700 mt-2">{backfillError}</p>
              )}
            </div>
          )}

          {/* ── Backfill result notice ───────────────────────── */}
          {backfillResult && (() => {
            const hasEntries = backfillResult.invoicesIssued > 0 || backfillResult.ledgerIssuedPosted > 0 || backfillResult.ledgerPaidPosted > 0;
            const allSkipped = backfillResult.invoicesIssuedErrors > 0 && backfillResult.invoicesIssued === 0 && backfillResult.ledgerIssuedPosted === 0;
            return (
              <div className={`mb-6 rounded-lg border px-5 py-4 ${allSkipped ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                <p className={`text-sm font-semibold ${allSkipped ? "text-amber-800" : "text-emerald-800"}`}>
                  {allSkipped ? "Billing entities required" : "Setup complete"}
                </p>
                <p className={`text-xs mt-1 ${allSkipped ? "text-amber-700" : "text-emerald-700"}`}>
                  {backfillResult.coaSeeded && `Chart of Accounts seeded (${backfillResult.coaAccounts} accounts). `}
                  {backfillResult.invoicesIssued > 0 && `${backfillResult.invoicesIssued} invoice(s) issued. `}
                  {backfillResult.ledgerIssuedPosted > 0 && `${backfillResult.ledgerIssuedPosted} INVOICE_ISSUED entr${backfillResult.ledgerIssuedPosted === 1 ? "y" : "ies"} posted. `}
                  {backfillResult.ledgerPaidPosted > 0 && `${backfillResult.ledgerPaidPosted} INVOICE_PAID entr${backfillResult.ledgerPaidPosted === 1 ? "y" : "ies"} posted. `}
                  {allSkipped && `${backfillResult.invoicesIssuedErrors} invoice(s) could not be issued — each contractor needs a billing entity first. `}
                  {!hasEntries && !allSkipped && "No new entries — all up to date."}
                </p>
                {allSkipped && (
                  <a
                    href="/manager/finance/billing-entities"
                    className="inline-block mt-2 text-xs font-medium text-amber-800 underline underline-offset-2"
                  >
                    Set up billing entities →
                  </a>
                )}
              </div>
            );
          })()}

          {/* ── Tab bar ─────────────────────────────────────── */}
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            {[
              { key: "journal",       label: "Journal" },
              { key: "trial-balance", label: "Trial Balance" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Filters ─────────────────────────────────────── */}
          <Panel className="mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  className="input input-sm"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  className="input input-sm"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>

              {tab === "journal" && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Building</label>
                    <select
                      className="input input-sm"
                      value={buildingId}
                      onChange={(e) => setBuildingId(e.target.value)}
                    >
                      <option value="">All buildings</option>
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Account</label>
                    <select
                      className="input input-sm"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      style={{ minWidth: 200 }}
                    >
                      <option value="">All accounts</option>
                      {ACCOUNT_TYPE_ORDER.map((type) => {
                        const group = accounts.filter((a) => a.accountType === type);
                        if (!group.length) return null;
                        return (
                          <optgroup key={type} label={ACCOUNT_TYPE_LABELS[type] || type}>
                            {group.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code ? `${a.code} — ` : ""}{a.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Event type</label>
                    <select
                      className="input input-sm"
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value)}
                    >
                      <option value="">All events</option>
                      {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <button
                className="btn btn-primary btn-sm"
                onClick={() => tab === "journal" ? fetchEntries(0) : fetchTrialBalance()}
              >
                Apply
              </button>
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                Reset
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Showing entries for {from || "all time"}{to ? ` – ${to}` : ""}
            </p>
          </Panel>

          {/* ── Journal tab ─────────────────────────────────── */}
          {tab === "journal" && (
            <Panel>
              {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
              {loading ? (
                <p className="text-gray-400 text-sm">Loading…</p>
              ) : entries.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-500 font-medium text-sm">No journal entries found</p>
                  <p className="text-gray-400 text-xs mt-2 max-w-md mx-auto">
                    Ledger entries are posted automatically when invoices are issued or paid.
                    {from && " Try widening the date range."}
                  </p>
                  {accounts.length > 0 && !backfillResult && (
                    <button
                      className="mt-4 btn btn-primary btn-sm"
                      onClick={() => runBackfill({ seedCoa: false, issueDrafts: true })}
                      disabled={backfilling}
                    >
                      {backfilling ? "Working…" : "Post historical entries"}
                    </button>
                  )}
                  {backfillError && (
                    <p className="text-xs text-red-600 mt-2">{backfillError}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                          <th className="pb-2 pr-3">Date</th>
                          <th className="pb-2 pr-3">Account</th>
                          <th className="pb-2 pr-3">Event</th>
                          <th className="pb-2 pr-3">Description</th>
                          <th className="pb-2 pr-3">Reference</th>
                          <th className="pb-2 pr-3 text-right">Debit CHF</th>
                          <th className="pb-2 text-right">Credit CHF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => (
                          <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-2 pr-3 whitespace-nowrap text-gray-600">{formatDate(e.date)}</td>
                            <td className="py-2 pr-3">
                              <span className="font-mono text-xs text-gray-400 mr-1">{e.accountCode}</span>
                              <span className="text-gray-800">{e.accountName}</span>
                            </td>
                            <td className="py-2 pr-3 text-xs text-gray-500 whitespace-nowrap">
                              {SOURCE_TYPE_LABELS[e.sourceType] || e.sourceType || "—"}
                            </td>
                            <td className="py-2 pr-3 text-gray-700 max-w-xs truncate">{e.description}</td>
                            <td className="py-2 pr-3 font-mono text-xs text-gray-400">{e.reference || "—"}</td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {e.debitCents > 0 ? <span className="text-gray-900">{formatCHF(e.debitCents)}</span> : <span className="text-gray-200">—</span>}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {e.creditCents > 0 ? <span className="text-gray-900">{formatCHF(e.creditCents)}</span> : <span className="text-gray-200">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                    <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} entries</span>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={offset === 0}
                        onClick={() => fetchEntries(Math.max(0, offset - PAGE_SIZE))}
                      >
                        Previous
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={offset + PAGE_SIZE >= total}
                        onClick={() => fetchEntries(offset + PAGE_SIZE)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </Panel>
          )}

          {/* ── Trial Balance tab ────────────────────────────── */}
          {tab === "trial-balance" && (
            <Panel>
              {tbError && <p className="text-red-600 text-sm mb-3">{tbError}</p>}
              {tbLoading ? (
                <p className="text-gray-400 text-sm">Loading…</p>
              ) : balances.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-500 font-medium text-sm">No entries for this period</p>
                  <p className="text-gray-400 text-xs mt-1">Adjust the date range and apply filters above.</p>
                </div>
              ) : (
                <>
                  {/* Balanced status banner */}
                  <div className={`mb-4 px-4 py-2 rounded text-sm font-medium ${tbBalanced ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {tbBalanced
                      ? "✓ Ledger is balanced — total debits equal total credits"
                      : `⚠ Ledger is out of balance — difference: CHF ${formatCHF(Math.abs(tbTotals.debit - tbTotals.credit))}`}
                  </div>

                  {/* Grouped by account type */}
                  {ACCOUNT_TYPE_ORDER.map((type) => {
                    const rows = tbByType[type];
                    if (!rows) return null;
                    const typeDebit  = rows.reduce((s, b) => s + b.debitCents, 0);
                    const typeCredit = rows.reduce((s, b) => s + b.creditCents, 0);
                    return (
                      <div key={type} className="mb-6">
                        <div className={`flex items-center justify-between px-3 py-1.5 rounded-t text-xs font-semibold uppercase tracking-wide ${ACCOUNT_TYPE_CLASSES[type]}`}>
                          <span>{ACCOUNT_TYPE_LABELS[type] || type}</span>
                          <span className="font-mono">{rows.length} account{rows.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="overflow-x-auto border border-gray-200 rounded-b">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 bg-gray-50">
                                <th className="px-3 py-2">Code</th>
                                <th className="px-3 py-2">Account</th>
                                <th className="px-3 py-2 text-right">Debit CHF</th>
                                <th className="px-3 py-2 text-right">Credit CHF</th>
                                <th className="px-3 py-2 text-right">Balance CHF</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((b) => {
                                const isDebitBal = b.balanceCents >= 0;
                                return (
                                  <tr key={b.accountId} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="px-3 py-2 font-mono text-xs text-gray-400">{b.accountCode || "—"}</td>
                                    <td className="px-3 py-2 text-gray-800">{b.accountName}</td>
                                    <td className="px-3 py-2 text-right font-mono text-gray-700">{formatCHF(b.debitCents)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-gray-700">{formatCHF(b.creditCents)}</td>
                                    <td className={`px-3 py-2 text-right font-mono font-semibold ${isDebitBal ? "text-gray-900" : "text-blue-700"}`}>
                                      {isDebitBal ? "" : "("}
                                      {formatCHF(Math.abs(b.balanceCents))}
                                      {isDebitBal ? "" : ")"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-gray-300 bg-gray-50 text-xs font-semibold">
                                <td colSpan={2} className="px-3 py-1.5 text-gray-600">Subtotal</td>
                                <td className="px-3 py-1.5 text-right font-mono">{formatCHF(typeDebit)}</td>
                                <td className="px-3 py-1.5 text-right font-mono">{formatCHF(typeCredit)}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })}

                  {/* Grand total */}
                  <div className="flex justify-end gap-8 text-sm font-semibold border-t-2 border-gray-300 pt-3 mt-2">
                    <span>Grand Total Debit: <span className="font-mono">{formatCHF(tbTotals.debit)}</span></span>
                    <span>Grand Total Credit: <span className="font-mono">{formatCHF(tbTotals.credit)}</span></span>
                    <span className={tbBalanced ? "text-emerald-700" : "text-red-600"}>
                      {tbBalanced ? "Balanced ✓" : `Off by CHF ${formatCHF(Math.abs(tbTotals.debit - tbTotals.credit))}`}
                    </span>
                  </div>
                </>
              )}
            </Panel>
          )}

        </PageContent>
      </PageShell>
    </AppShell>
  );
}
