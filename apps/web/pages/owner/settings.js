import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import ErrorBanner from "../../components/ui/ErrorBanner";
import Badge from "../../components/ui/Badge";
import { legalVariant } from "../../lib/statusVariants";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/format";
import { ownerAuthHeaders } from "../../lib/api";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
import DepreciationStandards from "../../components/DepreciationStandards";
import OwnerPicker from "../../components/OwnerPicker";
import SortableHeader from "../../components/SortableHeader";
import { useLocalSort } from "../../lib/tableUtils";
import { withTranslations } from "../../lib/i18n";

const SETTINGS_TABS = [
  { key: "ACCOUNT", label: "Account" },
  { key: "RISK_PROFILE", label: "Risk Profile" },
  { key: "NOTIFICATIONS", label: "Notifications" },
  { key: "INTEGRATIONS", label: "Integrations" },
  { key: "LEGAL", label: "Legal Sources" },
  { key: "STANDARDS", label: "Standards" },
];
const TAB_KEYS = ["account", "risk-profile", "notifications", "integrations", "legal", "standards"];

const USER_LABELS = {
  exit_optimizer: "Prepare for sale",
  yield_maximizer: "Maximize income",
  value_builder: "Improve long-term value",
  capital_preserver: "Keep things stable",
  opportunistic_repositioner: "Upgrade and reposition",
};

export default function OwnerSettingsPage() {
  const router = useRouter();
  const activeTab = router.isReady ? (Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true }
    );
  }, [router]);

  // ── Account tab ──────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  const [accountError, setAccountError] = useState("");

  const loadUser = useCallback(async () => {
    if (user) return;
    setUserLoading(true);
    try {
      const res = await fetch("/api/users/me", { headers: ownerAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.data) {
        setUser(data.data);
        setNameDraft(data.data.name || "");
        setEmailDraft(data.data.email || "");
      }
    } catch { /* silent */ }
    finally { setUserLoading(false); }
  }, [user]);

  useEffect(() => { if (activeTab === 0) loadUser(); }, [activeTab, loadUser]);

  async function saveProfile() {
    setAccountError("");
    setAccountNotice("");
    setAccountSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: JSON.stringify({ name: nameDraft, email: emailDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Save failed");
      setUser(data.data);
      setAccountNotice("Profile updated.");
    } catch (e) {
      setAccountError(String(e?.message || e));
    } finally {
      setAccountSaving(false);
    }
  }

  async function changePassword() {
    setAccountError("");
    setAccountNotice("");
    if (!currentPwd) { setAccountError("Enter your current password."); return; }
    if (!newPwd) { setAccountError("Enter a new password."); return; }
    if (newPwd.length < 8) { setAccountError("New password must be at least 8 characters."); return; }
    if (newPwd !== confirmPwd) { setAccountError("New passwords do not match."); return; }
    setPwdSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Save failed");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setAccountNotice("Password changed.");
    } catch (e) {
      setAccountError(String(e?.message || e));
    } finally {
      setPwdSaving(false);
    }
  }

  // ── Risk Profile tab ─────────────────────────────────────────
  const [stratProfile, setStratProfile] = useState(undefined);
  const [stratLoading, setStratLoading] = useState(false);

  const loadStratProfile = useCallback(async () => {
    if (stratProfile !== undefined) return;
    setStratLoading(true);
    try {
      const res = await fetch("/api/strategy/owner-profile-current", { headers: ownerAuthHeaders() });
      const data = await res.json();
      setStratProfile(data.profile ?? null);
    } catch { setStratProfile(null); }
    finally { setStratLoading(false); }
  }, [stratProfile]);

  useEffect(() => { if (activeTab === 1) loadStratProfile(); }, [activeTab, loadStratProfile]);

  // ── Legal Sources tab ────────────────────────────────────────
  const [legalSources, setLegalSources] = useState([]);
  const [legalVariables, setLegalVariables] = useState([]);
  const [legalLoading, setLegalLoading] = useState(false);
  const [scopeFilter, setScopeFilter] = useState("ALL");

  const { sortField: lsSF, sortDir: lsSD, handleSort: handleLsSort } = useLocalSort("name", "asc");
  const { sortField: lvSF, sortDir: lvSD, handleSort: handleLvSort } = useLocalSort("key", "asc");

  const loadLegalData = useCallback(async () => {
    if (legalSources.length > 0) return;
    setLegalLoading(true);
    try {
      const [srcRes, varRes] = await Promise.all([
        fetch("/api/legal/sources", { headers: ownerAuthHeaders() }),
        fetch("/api/legal/variables", { headers: ownerAuthHeaders() }),
      ]);
      const srcData = await srcRes.json();
      const varData = await varRes.json();
      setLegalSources(srcData?.data || []);
      setLegalVariables(varData?.data || []);
    } catch { /* silent */ }
    finally { setLegalLoading(false); }
  }, [legalSources.length]);

  useEffect(() => { if (activeTab === 4) loadLegalData(); }, [activeTab, loadLegalData]);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader title="Settings" subtitle="Manage your account, risk profile, and preferences." />
        <PageContent>
          <OwnerPicker onSelect={() => { setUser(null); setStratProfile(undefined); setLegalSources([]); }} />

          {/* Tab strip */}
          <ScrollableTabs activeIndex={activeTab}>
            {SETTINGS_TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {tab.label}
              </button>
            ))}
          </ScrollableTabs>

          {/* Legal count */}
          <span className="tab-panel-count">
            {activeTab === 4 ? `${legalSources.length} source${legalSources.length !== 1 ? "s" : ""} · ${legalVariables.length} variable${legalVariables.length !== 1 ? "s" : ""}` : null}
          </span>

          {activeTab !== 5 && (
            <>
              {/* ── Account tab ─────────────────────────────────── */}
              <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
                <div className="px-4 py-4 space-y-4">
                  {accountError && (
                    <div className="notice notice-err">
                      <strong className="text-red-700">Error:</strong> {accountError}
                    </div>
                  )}
                  {accountNotice && (
                    <div className="notice notice-ok">
                      <strong className="text-green-700">OK:</strong> {accountNotice}
                    </div>
                  )}

                  {/* Profile */}
                  <div className="card grid gap-3">
                    <div className="font-bold">Profile</div>
                    {userLoading ? (
                      <p className="loading-text">Loading…</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600">Display name</span>
                          <input
                            type="text"
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            className="input"
                            placeholder="Your name"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600">Email address</span>
                          <input
                            type="email"
                            value={emailDraft}
                            onChange={(e) => setEmailDraft(e.target.value)}
                            className="input"
                            placeholder="you@example.com"
                          />
                          <span className="text-xs text-slate-400">Changing your email also changes your login credential.</span>
                        </label>
                      </div>
                    )}
                    <div>
                      <button
                        className="button-primary"
                        onClick={saveProfile}
                        disabled={accountSaving || userLoading}
                      >
                        {accountSaving ? "Saving…" : "Save profile"}
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="card grid gap-3">
                    <div className="font-bold">Change password</div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-600">Current password</span>
                        <input
                          type="password"
                          value={currentPwd}
                          onChange={(e) => setCurrentPwd(e.target.value)}
                          className="input"
                          autoComplete="current-password"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-600">New password</span>
                        <input
                          type="password"
                          value={newPwd}
                          onChange={(e) => setNewPwd(e.target.value)}
                          className="input"
                          autoComplete="new-password"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-600">Confirm new password</span>
                        <input
                          type="password"
                          value={confirmPwd}
                          onChange={(e) => setConfirmPwd(e.target.value)}
                          className="input"
                          autoComplete="new-password"
                        />
                      </label>
                    </div>
                    <div>
                      <button
                        className="button-primary"
                        onClick={changePassword}
                        disabled={pwdSaving}
                      >
                        {pwdSaving ? "Saving…" : "Change password"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Risk Profile tab ────────────────────────────── */}
              <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
                <div className="px-4 py-4">
                  {(stratLoading || stratProfile === undefined) ? (
                    <p className="loading-text">Loading…</p>
                  ) : stratProfile === null ? (
                    <div className="coming-soon">
                      <span className="coming-soon-badge">Not set up</span>
                      <p className="coming-soon-title">No strategy profile yet</p>
                      <p className="coming-soon-text">
                        Complete the questionnaire to define your investment strategy.
                        It shapes how maintenance priorities and recommendations are presented to you.
                      </p>
                      <Link href="/owner/strategy" className="button-primary mt-4 inline-block">
                        Set up strategy →
                      </Link>
                    </div>
                  ) : (
                    <div className="card space-y-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Primary archetype</p>
                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                          {USER_LABELS[stratProfile.primaryArchetype] || stratProfile.primaryArchetype}
                        </h2>
                        {stratProfile.secondaryArchetype && stratProfile.secondaryArchetype !== stratProfile.primaryArchetype && (
                          <p className="mt-1 text-sm text-slate-600">
                            Secondary: {USER_LABELS[stratProfile.secondaryArchetype] || stratProfile.secondaryArchetype}
                          </p>
                        )}
                      </div>
                      {stratProfile.riskTolerance && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Risk tolerance</p>
                          <p className="mt-1 text-sm text-slate-800 capitalize">{stratProfile.riskTolerance.toLowerCase()}</p>
                        </div>
                      )}
                      {stratProfile.investmentHorizonYears && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Investment horizon</p>
                          <p className="mt-1 text-sm text-slate-800">{stratProfile.investmentHorizonYears} years</p>
                        </div>
                      )}
                      <div>
                        <Link href="/owner/strategy" className="button-primary text-sm inline-block">
                          Edit strategy profile →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Notifications tab ───────────────────────────── */}
              <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
                <div className="px-4 py-4">
                  <div className="coming-soon">
                    <span className="coming-soon-badge">Coming soon</span>
                    <p className="coming-soon-title">Notification Preferences</p>
                    <p className="coming-soon-text">
                      Configure email and in-app notification rules per event type.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Integrations tab ────────────────────────────── */}
              <div className={activeTab === 3 ? "tab-panel-active" : "tab-panel"}>
                <div className="px-4 py-4">
                  <div className="coming-soon">
                    <span className="coming-soon-badge">Coming soon</span>
                    <p className="coming-soon-title">Integrations</p>
                    <p className="coming-soon-text">
                      Connect third-party services — accounting, calendars, and more.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Legal Sources tab (read-only) ───────────────── */}
              <div className={activeTab === 4 ? "tab-panel-active" : "tab-panel"}>
                <div className="px-4 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Legal Sources</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Swiss tenancy law data sources — reference rates, CPI, ASLOCA depreciation, and legislation.
                    </p>
                  </div>

                  {!legalLoading && legalSources.length > 1 && (
                    <LegalScopeFilterBar
                      sources={legalSources}
                      activeFilter={scopeFilter}
                      onFilter={setScopeFilter}
                    />
                  )}
                </div>

                {legalLoading ? (
                  <p className="loading-text">Loading sources…</p>
                ) : legalSources.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-text">No legal sources found.</p>
                  </div>
                ) : (
                  <>
                    <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                      {legalSources
                        .filter((s) => scopeFilter === "ALL" || s.scope === scopeFilter)
                        .map((s) => (
                          <div key={s.id} className="table-card">
                            <div className="flex items-start justify-between gap-2">
                              <span className="table-card-head">
                                {s.url ? (
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.name}</a>
                                ) : s.name}
                              </span>
                              <Badge variant={legalVariant(s.status)} size="sm">{s.status}</Badge>
                            </div>
                            <div className="table-card-footer">
                              <Badge variant={s.scope === "FEDERAL" ? "info" : "default"} size="sm">
                                {s.scope === "FEDERAL" ? "Federal" : s.scope}
                              </Badge>
                              <span>{s.lastSuccessAt ? formatDate(s.lastSuccessAt) : "Never synced"}</span>
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="hidden sm:block data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <SortableHeader label="Name" field="name" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                            <SortableHeader label="Scope" field="scope" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                            <SortableHeader label="Frequency" field="frequency" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                            <SortableHeader label="Status" field="status" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                            <SortableHeader label="Last Synced" field="lastSynced" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                          </tr>
                        </thead>
                        <tbody>
                          {[...legalSources]
                            .filter((s) => scopeFilter === "ALL" || s.scope === scopeFilter)
                            .sort((a, b) => {
                              let va = "", vb = "";
                              if (lsSF === "status") { va = a.status || ""; vb = b.status || ""; }
                              else if (lsSF === "scope") { va = a.scope || ""; vb = b.scope || ""; }
                              else if (lsSF === "frequency") { va = a.updateFrequency || ""; vb = b.updateFrequency || ""; }
                              else if (lsSF === "lastSynced") { va = a.lastSuccessAt || ""; vb = b.lastSuccessAt || ""; }
                              else { va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); }
                              return lsSD === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
                            })
                            .map((s) => (
                              <tr key={s.id}>
                                <td className="cell-bold">
                                  {s.url ? (
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.name}</a>
                                  ) : s.name}
                                </td>
                                <td>
                                  <Badge variant={s.scope === "FEDERAL" ? "info" : "default"} size="sm">
                                    {s.scope === "FEDERAL" ? "Federal" : s.scope}
                                  </Badge>
                                </td>
                                <td>{s.updateFrequency || "—"}</td>
                                <td><Badge variant={legalVariant(s.status)} size="sm">{s.status}</Badge></td>
                                <td>{s.lastSuccessAt ? formatDate(s.lastSuccessAt) : "Never"}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {!legalLoading && legalVariables.length > 0 && (
                  <>
                    <div className="px-4 py-3 border-t border-slate-100">
                      <h3 className="text-sm font-semibold text-slate-800">Legal Variables</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{legalVariables.length} variable{legalVariables.length !== 1 ? "s" : ""} tracked</p>
                    </div>
                    <div className="hidden sm:block data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <SortableHeader label="Key" field="key" sortField={lvSF} sortDir={lvSD} onSort={handleLvSort} />
                            <SortableHeader label="Description" field="description" sortField={lvSF} sortDir={lvSD} onSort={handleLvSort} />
                            <th>Versions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...legalVariables].sort((a, b) => {
                            let va = "", vb = "";
                            if (lvSF === "description") { va = (a.description || "").toLowerCase(); vb = (b.description || "").toLowerCase(); }
                            else { va = (a.key || "").toLowerCase(); vb = (b.key || "").toLowerCase(); }
                            return lvSD === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
                          }).map((v) => (
                            <tr key={v.id}>
                              <td className="font-mono text-xs">{v.key}</td>
                              <td>{v.description || "—"}</td>
                              <td>{v.versions?.length || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                      {legalVariables.map((v) => (
                        <div key={v.id} className="table-card">
                          <span className="font-mono text-xs text-slate-700">{v.key}</span>
                          <p className="table-card-head mt-0.5">{v.description || "—"}</p>
                          <div className="table-card-footer">
                            <span>{v.versions?.length || 0} version{(v.versions?.length || 0) !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Standards tab — renders its own panels */}
          {activeTab === 5 && <DepreciationStandards />}

        </PageContent>
      </PageShell>
    </AppShell>
  );
}

// ── Legal scope filter (same as manager settings) ────────────
function LegalScopeFilterBar({ sources, activeFilter, onFilter }) {
  const scopeSet = new Set(sources.map((s) => s.scope));
  const cantonScopes = [...scopeSet].filter((s) => s !== "FEDERAL").sort();
  const tabs = [
    { label: "All", value: "ALL" },
    ...(scopeSet.has("FEDERAL") ? [{ label: "Federal", value: "FEDERAL" }] : []),
    ...cantonScopes.map((c) => ({ label: c, value: c })),
  ];
  if (tabs.length <= 2) return null;
  return (
    <div className="mt-3 mb-3 flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onFilter(tab.value)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            activeFilter === tab.value
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export const getStaticProps = withTranslations(["common","owner"]);
