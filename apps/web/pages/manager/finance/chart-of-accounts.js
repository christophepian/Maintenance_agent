import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

/* ─── Tabs ─────────────────────────────────────────────── */

const TABS = [
  { key: "EXPENSE_TYPES", label: "Expense Types" },
  { key: "ACCOUNTS", label: "Accounts" },
  { key: "MAPPINGS", label: "Mappings" },
];
const TAB_KEYS = ["expense_types", "accounts", "mappings"];

/* ─── Helpers ──────────────────────────────────────────── */

function StatusBadge({ active }) {
  const cls = active
    ? "bg-green-100 text-green-700 border-green-300"
    : "bg-red-50 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function AccountTypeBadge({ type }) {
  const map = {
    EXPENSE: "bg-amber-100 text-amber-700",
    REVENUE: "bg-blue-100 text-blue-700",
    ASSET: "bg-slate-100 text-slate-600",
    LIABILITY: "bg-red-100 text-red-700",
  };
  const cls = map[type] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {type}
    </span>
  );
}

/* ─── Page ─────────────────────────────────────────────── */

export default function ChartOfAccountsPage() {
  const router = useRouter();

  /* Tab state — driven by URL query param for deep-linkability */
  const activeTab = router.isReady
    ? Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0
    : 0;
  const setActiveTab = useCallback(
    (index) => {
      router.push(
        { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  /* Data */
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seedResult, setSeedResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  /* New-item forms */
  const [newET, setNewET] = useState({ name: "", description: "", code: "" });
  const [newAcc, setNewAcc] = useState({ name: "", code: "", accountType: "EXPENSE" });
  const [newMapping, setNewMapping] = useState({ expenseTypeId: "", accountId: "" });

  const h = authHeaders();

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [etRes, accRes, mapRes] = await Promise.all([
        fetch("/api/coa/expense-types", { headers: h }),
        fetch("/api/coa/accounts", { headers: h }),
        fetch("/api/coa/expense-mappings", { headers: h }),
      ]);
      const etJson = await etRes.json();
      const accJson = await accRes.json();
      const mapJson = await mapRes.json();
      setExpenseTypes(etJson?.data || []);
      setAccounts(accJson?.data || []);
      setMappings(mapJson?.data || []);
    } catch {
      setError("Failed to load chart of accounts data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ─── Actions ───────────────────────────────────────── */

  const handleSeed = async () => {
    setActionLoading(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/coa/seed", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Seed failed");
      setSeedResult(json?.data || json);
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateET = async (e) => {
    e.preventDefault();
    if (!newET.name.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/coa/expense-types", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newET.name.trim(),
          description: newET.description.trim() || undefined,
          code: newET.code.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Create failed");
      setNewET({ name: "", description: "", code: "" });
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateAcc = async (e) => {
    e.preventDefault();
    if (!newAcc.name.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/coa/accounts", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAcc.name.trim(),
          code: newAcc.code.trim() || undefined,
          accountType: newAcc.accountType,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Create failed");
      setNewAcc({ name: "", code: "", accountType: "EXPENSE" });
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateMapping = async (e) => {
    e.preventDefault();
    if (!newMapping.expenseTypeId || !newMapping.accountId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/coa/expense-mappings", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseTypeId: newMapping.expenseTypeId,
          accountId: newMapping.accountId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Create failed");
      setNewMapping({ expenseTypeId: "", accountId: "" });
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMapping = async (id) => {
    if (!confirm("Remove this expense mapping?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/coa/expense-mappings/${id}`, {
        method: "DELETE",
        headers: h,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || "Delete failed");
      }
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── Render ────────────────────────────────────────── */

  const seedButton = (
    <button
      onClick={handleSeed}
      disabled={actionLoading}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {actionLoading ? "Seeding\u2026" : "Seed Swiss Taxonomy"}
    </button>
  );

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Chart of Accounts"
          subtitle="Manage expense types, accounts, and expense-to-account mappings"
          actions={seedButton}
        />
        <PageContent>
          {error && (
            <div className="error-banner">
              {error}
              <button
                onClick={() => setError("")}
                className="ml-3 font-bold text-red-700 hover:text-red-900"
              >
                &#10005;
              </button>
            </div>
          )}

          {seedResult && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              &#10003; Seeded: {seedResult.expenseTypes} expense types, {seedResult.accounts} accounts, {seedResult.mappings} mappings
            </div>
          )}

          {/* Tab strip */}
          <div className="tab-strip">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-60">
                  {i === 0 ? expenseTypes.length : i === 1 ? accounts.length : mappings.length}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="loading-text">Loading&#8230;</p>
          ) : (
            <>
              {/* ─── Tab 0: Expense Types ─────────────── */}
              <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
                <Panel bodyClassName="p-0">
                  {expenseTypes.length === 0 ? (
                    <div className="empty-state">
                      <p className="empty-state-text">
                        No expense types yet. Click <strong>Seed Swiss Taxonomy</strong> to get started with 12 standard expense types and 4 accounts.
                      </p>
                    </div>
                  ) : (
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Code</th>
                          <th>Description</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseTypes.map((et) => (
                          <tr key={et.id}>
                            <td className="cell-bold">{et.name}</td>
                            <td><span className="code-small">{et.code || "\u2014"}</span></td>
                            <td>{et.description || "\u2014"}</td>
                            <td><StatusBadge active={et.isActive} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Inline create form */}
                  <form onSubmit={handleCreateET} className="flex items-end gap-3 border-t border-slate-200 p-4">
                    <div className="flex-[2]">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Name *</label>
                      <input
                        className="input"
                        value={newET.name}
                        onChange={(e) => setNewET({ ...newET, name: e.target.value })}
                        placeholder="e.g. Elevator Maintenance"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Code</label>
                      <input
                        className="input"
                        value={newET.code}
                        onChange={(e) => setNewET({ ...newET, code: e.target.value })}
                        placeholder="e.g. LIFT-M"
                      />
                    </div>
                    <div className="flex-[2]">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
                      <input
                        className="input"
                        value={newET.description}
                        onChange={(e) => setNewET({ ...newET, description: e.target.value })}
                        placeholder="Optional description"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading || !newET.name.trim()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>
                </Panel>
              </div>

              {/* ─── Tab 1: Accounts ──────────────────── */}
              <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
                <Panel bodyClassName="p-0">
                  {accounts.length === 0 ? (
                    <div className="empty-state">
                      <p className="empty-state-text">
                        No accounts yet. Click <strong>Seed Swiss Taxonomy</strong> to get started.
                      </p>
                    </div>
                  ) : (
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Code</th>
                          <th>Type</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((acc) => (
                          <tr key={acc.id}>
                            <td className="cell-bold">{acc.name}</td>
                            <td><span className="code-small">{acc.code || "\u2014"}</span></td>
                            <td><AccountTypeBadge type={acc.accountType} /></td>
                            <td><StatusBadge active={acc.isActive} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Inline create form */}
                  <form onSubmit={handleCreateAcc} className="flex items-end gap-3 border-t border-slate-200 p-4">
                    <div className="flex-[2]">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Name *</label>
                      <input
                        className="input"
                        value={newAcc.name}
                        onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })}
                        placeholder="e.g. Owner Charges"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Code</label>
                      <input
                        className="input"
                        value={newAcc.code}
                        onChange={(e) => setNewAcc({ ...newAcc, code: e.target.value })}
                        placeholder="e.g. 5000"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
                      <select
                        className="input"
                        value={newAcc.accountType}
                        onChange={(e) => setNewAcc({ ...newAcc, accountType: e.target.value })}
                      >
                        <option value="EXPENSE">EXPENSE</option>
                        <option value="REVENUE">REVENUE</option>
                        <option value="ASSET">ASSET</option>
                        <option value="LIABILITY">LIABILITY</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading || !newAcc.name.trim()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>
                </Panel>
              </div>

              {/* ─── Tab 2: Expense Mappings ──────────── */}
              <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
                <Panel bodyClassName="p-0">
                  <p className="px-4 pt-3 pb-2 text-sm text-slate-500">
                    Each mapping links an expense type to an accounting bucket. Org-wide defaults have no building override.
                  </p>

                  {mappings.length === 0 ? (
                    <div className="empty-state">
                      <p className="empty-state-text">
                        No mappings yet. Seed the taxonomy or add one below.
                      </p>
                    </div>
                  ) : (
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>Expense Type</th>
                          <th></th>
                          <th>Account</th>
                          <th>Scope</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((m) => (
                          <tr key={m.id}>
                            <td className="cell-bold">{m.expenseType?.name || m.expenseTypeId}</td>
                            <td className="text-slate-400">{"\u2192"}</td>
                            <td>{m.account?.name || m.accountId}{m.account?.code ? ` (${m.account.code})` : ""}</td>
                            <td>
                              <span className="text-xs text-slate-400">
                                {m.building?.name || "Org-wide"}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => handleDeleteMapping(m.id)}
                                disabled={actionLoading}
                                className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Inline create form */}
                  <form onSubmit={handleCreateMapping} className="flex items-end gap-3 border-t border-slate-200 p-4">
                    <div className="flex-[2]">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Expense Type *</label>
                      <select
                        className="input"
                        value={newMapping.expenseTypeId}
                        onChange={(e) => setNewMapping({ ...newMapping, expenseTypeId: e.target.value })}
                      >
                        <option value="">Select&#8230;</option>
                        {expenseTypes.map((et) => (
                          <option key={et.id} value={et.id}>{et.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-[2]">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Account *</label>
                      <select
                        className="input"
                        value={newMapping.accountId}
                        onChange={(e) => setNewMapping({ ...newMapping, accountId: e.target.value })}
                      >
                        <option value="">Select&#8230;</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.name} ({a.code || "\u2014"})</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading || !newMapping.expenseTypeId || !newMapping.accountId}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>
                </Panel>
              </div>
            </>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
