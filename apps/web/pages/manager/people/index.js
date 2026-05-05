import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import SortableHeader from "../../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../../lib/tableUtils";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Link from "next/link";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import Badge from "../../../components/ui/Badge";
import { authHeaders } from "../../../lib/api";

import { cn } from "../../../lib/utils";
import ScrollableTabs from "../../../components/mobile/ScrollableTabs";
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";
/* ─── Owner create form ──────────────────────────────────── */

const OWNER_FORM_DEFAULT = { name: "", email: "", password: "" };
const BILLING_FORM_DEFAULT = { addressLine1: "", addressLine2: "", postalCode: "", city: "", country: "CH", iban: "", vatNumber: "", defaultVatRate: "0" };

function OwnersTab({ showAddForm, onAddFormClose }) {
  const { t } = useTranslation("manager");
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const { sortField: oSortField, sortDir: oSortDir, handleSort: handleOwnerSort } = useLocalSort("name", "asc");
  const sortedOwners = useMemo(() => clientSort(owners, oSortField, oSortDir, (o, f) => {
    if (f === "name") return (o.name || "").toLowerCase();
    if (f === "email") return (o.email || "").toLowerCase();
    if (f === "billingEntity") return (o.billingEntity?.name || "").toLowerCase();
    return "";
  }), [owners, oSortField, oSortDir]);

  const [ownerForm, setOwnerForm] = useState(OWNER_FORM_DEFAULT);
  const [ownerSubmitting, setOwnerSubmitting] = useState(false);

  // Billing entity inline expansion: billingForms[ownerId] = form state
  const [expandedBilling, setExpandedBilling] = useState(null); // ownerId
  const [billingForm, setBillingForm] = useState(BILLING_FORM_DEFAULT);
  const [billingSubmitting, setBillingSubmitting] = useState(false);

  async function loadOwners() {
    setLoading(true);
    try {
      const res = await fetch("/api/people/owners", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load owners");
      setOwners(data.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOwners(); }, []);

  async function handleCreateOwner(e) {
    e.preventDefault();
    setOwnerSubmitting(true);
    setError(""); setNotice("");
    try {
      const res = await fetch("/api/people/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(ownerForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to create owner");
      setNotice(`Owner "${ownerForm.name}" created.`);
      setOwnerForm(OWNER_FORM_DEFAULT);
      onAddFormClose();
      await loadOwners();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setOwnerSubmitting(false);
    }
  }

  function openBilling(owner) {
    setExpandedBilling(owner.id);
    setBillingForm({ ...BILLING_FORM_DEFAULT, name: owner.name });
  }

  async function handleCreateBillingEntity(e, ownerId) {
    e.preventDefault();
    setBillingSubmitting(true);
    setError(""); setNotice("");
    try {
      const res = await fetch(`/api/people/owners/${ownerId}/billing-entity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...billingForm, defaultVatRate: Number(billingForm.defaultVatRate) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to create billing entity");
      setNotice("Billing entity created.");
      setExpandedBilling(null);
      await loadOwners();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBillingSubmitting(false);
    }
  }

  return (
    <div>
      {(error || notice) && (
        <div className={cn("mb-3 rounded-lg border px-4 py-2.5 text-sm", error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700")}>
          {error || notice}
          <button onClick={() => { setError(""); setNotice(""); }} className="ml-3 opacity-60 hover:opacity-100" aria-label={t("manager:peopleIndex.ariaLabel.dismiss")}>✕</button>
        </div>
      )}

      {/* Add owner form */}
      {showAddForm && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">{t("manager:peopleIndex.text.newOwner")}</p>
          <form onSubmit={handleCreateOwner} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.name")}</label>
              <input
                required value={ownerForm.name}
                onChange={(e) => setOwnerForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-44"
                placeholder={t("manager:peopleIndex.placeholder.jeanDupont")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.email")}</label>
              <input
                required type="email" value={ownerForm.email}
                onChange={(e) => setOwnerForm((f) => ({ ...f, email: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-52"
                placeholder={t("manager:peopleIndex.placeholder.jeanExampleCom")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.password")}</label>
              <input
                required type="password" value={ownerForm.password}
                onChange={(e) => setOwnerForm((f) => ({ ...f, password: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-40"
                placeholder={t("manager:peopleIndex.placeholder.temporaryPassword")}
              />
            </div>
            <button type="submit" disabled={ownerSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {ownerSubmitting ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={onAddFormClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p className="loading-text">{t("manager:peopleIndex.text.loadingOwners")}</p>
      ) : owners.length === 0 && !showAddForm ? (
        <div className="empty-state">
          <p className="empty-state-text">{t("manager:peopleIndex.text.noOwnersYetUseTheAddOwnerButtonAboveToCreateOne")}</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
            {sortedOwners.map((owner) => (
              <div key={owner.id}>
                <div
                  className="table-card cursor-pointer hover:bg-slate-50/80 transition-colors"
                  onClick={() => window.location.href = `/manager/people/owners`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="table-card-head">{owner.name}</p>
                    {owner.billingEntity
                      ? <Badge variant="success" size="md">{t("manager:peopleIndex.text.billingSet")}</Badge>
                      : <Badge variant="muted" size="md">{t("manager:peopleIndex.text.notSet")}</Badge>}
                  </div>
                  <p className="table-card-sub">{owner.email || "—"}</p>
                  {!owner.billingEntity && (
                    <button
                      onClick={(e) => { e.stopPropagation(); expandedBilling === owner.id ? setExpandedBilling(null) : openBilling(owner); }}
                      className="mt-2.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {expandedBilling === owner.id ? "Cancel" : "Set up billing →"}
                    </button>
                  )}
                </div>
                {expandedBilling === owner.id && (
                  <div className="bg-slate-50 px-4 py-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-600 mb-3">Billing entity for {owner.name}</p>
                    <form onSubmit={(e) => handleCreateBillingEntity(e, owner.id)} className="flex flex-wrap gap-3 items-end">
                      <div className="w-full">
                        <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.address")}</label>
                        <input required value={billingForm.addressLine1}
                          onChange={(e) => setBillingForm((f) => ({ ...f, addressLine1: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-full" placeholder={t("manager:peopleIndex.placeholder.rueDeLaPaix1")} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.postalCode")}</label>
                        <input required value={billingForm.postalCode}
                          onChange={(e) => setBillingForm((f) => ({ ...f, postalCode: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-24" placeholder="1200" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.city")}</label>
                        <input required value={billingForm.city}
                          onChange={(e) => setBillingForm((f) => ({ ...f, city: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-32" placeholder={t("manager:peopleIndex.placeholder.genVe")} />
                      </div>
                      <div className="w-full">
                        <label className="block text-xs font-medium text-slate-600 mb-1">IBAN</label>
                        <input required value={billingForm.iban}
                          onChange={(e) => setBillingForm((f) => ({ ...f, iban: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-full font-mono" placeholder={t("manager:peopleIndex.placeholder.cH5604835012345678009")} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.vATNumber")}</label>
                        <input value={billingForm.vatNumber}
                          onChange={(e) => setBillingForm((f) => ({ ...f, vatNumber: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-36" placeholder={t("manager:peopleIndex.placeholder.cHE123456789")} />
                      </div>
                      <button type="submit" disabled={billingSubmitting}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {billingSubmitting ? "Saving…" : "Save billing entity"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Wide table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-table-border">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <SortableHeader label={t("manager:peopleIndex.prop.name")} field="name" sortField={oSortField} sortDir={oSortDir} onSort={handleOwnerSort} />
                  <SortableHeader label={t("manager:peopleIndex.prop.email")} field="email" sortField={oSortField} sortDir={oSortDir} onSort={handleOwnerSort} />
                  <SortableHeader label={t("manager:peopleIndex.prop.billingEntity")} field="billingEntity" sortField={oSortField} sortDir={oSortDir} onSort={handleOwnerSort} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedOwners.map((owner) => (
                  <>
                    <tr key={owner.id} className="cursor-pointer hover:bg-slate-50/80" onClick={() => window.location.href = `/manager/people/owners`}>
                      <td className="cell-bold">{owner.name}</td>
                      <td className="text-slate-500">{owner.email || "—"}</td>
                      <td>
                        {owner.billingEntity ? (
                          <Badge variant="success" size="md">
                            ✓ {owner.billingEntity.name}
                          </Badge>
                        ) : (
                          <Badge variant="muted" size="md">
                            Not set
                          </Badge>
                        )}
                      </td>
                      <td className="text-right">
                        {!owner.billingEntity && (
                          <button
                            onClick={() => expandedBilling === owner.id ? setExpandedBilling(null) : openBilling(owner)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {expandedBilling === owner.id ? "Cancel" : "Set up billing →"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedBilling === owner.id && (
                      <tr key={`${owner.id}-billing`}>
                        <td colSpan={4} className="bg-slate-50 px-4 py-4">
                          <p className="text-xs font-semibold text-slate-600 mb-3">Billing entity for {owner.name}</p>
                          <form onSubmit={(e) => handleCreateBillingEntity(e, owner.id)} className="flex flex-wrap gap-3 items-end">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.address")}</label>
                              <input required value={billingForm.addressLine1}
                                onChange={(e) => setBillingForm((f) => ({ ...f, addressLine1: e.target.value }))}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-52" placeholder={t("manager:peopleIndex.placeholder.rueDeLaPaix1")} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.postalCode")}</label>
                              <input required value={billingForm.postalCode}
                                onChange={(e) => setBillingForm((f) => ({ ...f, postalCode: e.target.value }))}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-24" placeholder="1200" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.city")}</label>
                              <input required value={billingForm.city}
                                onChange={(e) => setBillingForm((f) => ({ ...f, city: e.target.value }))}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-32" placeholder={t("manager:peopleIndex.placeholder.genVe")} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">IBAN</label>
                              <input required value={billingForm.iban}
                                onChange={(e) => setBillingForm((f) => ({ ...f, iban: e.target.value }))}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-52 font-mono" placeholder={t("manager:peopleIndex.placeholder.cH5604835012345678009")} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">{t("manager:peopleIndex.text.vATNumber")}</label>
                              <input value={billingForm.vatNumber}
                                onChange={(e) => setBillingForm((f) => ({ ...f, vatNumber: e.target.value }))}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-36" placeholder={t("manager:peopleIndex.placeholder.cHE123456789")} />
                            </div>
                            <button type="submit" disabled={billingSubmitting}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                              {billingSubmitting ? "Saving…" : "Save billing entity"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
const PEOPLE_TABS = [
  { key: "TENANTS", label: "Tenants" },
  { key: "VENDORS", label: "Vendors" },
  { key: "OWNERS", label: "Owners" },
];

const TAB_KEYS = ['tenants', 'vendors', 'owners'];

export default function ManagerPeoplePage() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const activeTab = router.isReady ? (Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true }
    );
  }, [router]);
  const [tenants, setTenants] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [tenantsTotal, setTenantsTotal] = useState(0);
  const [contractorsTotal, setContractorsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddOwner, setShowAddOwner] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tenantRes, vendorRes] = await Promise.all([
        fetch("/api/people/tenants?limit=200", { headers: authHeaders() }),
        fetch("/api/people/vendors?limit=200", { headers: authHeaders() }),
      ]);
      const tenantData = await tenantRes.json();
      const vendorData = await vendorRes.json();
      if (!tenantRes.ok) throw new Error(tenantData?.error?.message || "Failed to load tenants");
      setTenants(tenantData?.data || []);
      setTenantsTotal(tenantData?.total ?? tenantData?.data?.length ?? 0);
      setContractors(vendorData?.data || []);
      setContractorsTotal(vendorData?.total ?? vendorData?.data?.length ?? 0);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const { sortField: tSortField, sortDir: tSortDir, handleSort: handleTenantSort } = useLocalSort("name", "asc");
  const sortedTenants = useMemo(() => clientSort(tenants, tSortField, tSortDir, (tenant, f) => {
    if (f === "name") return (tenant.name || "").toLowerCase();
    if (f === "email") return (tenant.email || "").toLowerCase();
    if (f === "phone") return (tenant.phone || "").toLowerCase();
    if (f === "unit") return (tenant.unit?.unitNumber || "").toLowerCase();
    return "";
  }), [tenants, tSortField, tSortDir]);

  const { sortField: vSortField, sortDir: vSortDir, handleSort: handleVendorSort } = useLocalSort("name", "asc");
  const sortedVendors = useMemo(() => clientSort(contractors, vSortField, vSortDir, (c, f) => {
    if (f === "name") return (c.name || "").toLowerCase();
    if (f === "hourlyRate") return c.hourlyRate ?? 0;
    if (f === "phone") return (c.phone || "").toLowerCase();
    if (f === "email") return (c.email || "").toLowerCase();
    return "";
  }), [contractors, vSortField, vSortDir]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={t("manager:peopleIndex.title.contacts")}
          subtitle={t("manager:peopleIndex.prop.contactsAcrossTenantsVendorsAndOwners")}
        />
        <PageContent>
          <ErrorBanner error={error} />

          {/* Tab strip */}
          <ScrollableTabs activeIndex={activeTab}>
            {PEOPLE_TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {tab.label}
              </button>
            ))}
          </ScrollableTabs>

          {/* Count + CTA row — below tab strip, above table */}
          <div className="flex items-center justify-between">
            <span className="tab-panel-count">
              {activeTab === 0 && `${tenantsTotal} tenant${tenantsTotal !== 1 ? "s" : ""}`}
              {activeTab === 1 && `${contractorsTotal} contractor${contractorsTotal !== 1 ? "s" : ""}`}
              {activeTab === 2 && "Owners"}
            </span>
            {activeTab === 2 && (
              <div className="flex items-center gap-3">
                <Link href="/manager/people/owners" className="full-page-link">{t("manager:peopleIndex.text.openFullPage")}</Link>
                <button
                  onClick={() => setShowAddOwner((v) => !v)}
                  className="button-primary text-sm"
                >
                  {showAddOwner ? "Cancel" : "+ Add owner"}
                </button>
              </div>
            )}
          </div>

          {/* Tenants tab */}
          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">{t("manager:peopleIndex.text.loadingTenants")}</p>
            ) : tenants.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">{t("manager:peopleIndex.text.noTenantsFound")}</p>
              </div>
            ) : (
              <>
                {/* Mobile card list */}
                <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                  {tenants.slice(0, 200).map((tenant) => (
                    <div
                      key={tenant.id}
                      className="table-card cursor-pointer hover:bg-slate-50/80 transition-colors"
                      onClick={() => router.push(`/manager/people/tenants/${tenant.id}`)}
                    >
                      <p className="table-card-head">{tenant.name || "—"}</p>
                      {tenant.unit && (
                        <p className="table-card-sub">
                          {tenant.unit.unitNumber}{tenant.unit.floor ? ` · Floor ${tenant.unit.floor}` : ""}
                        </p>
                      )}
                      <div className="table-card-footer">
                        {tenant.email && <span>{tenant.email}</span>}
                        {tenant.phone && <span>{tenant.phone}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Wide table */}
                <div className="hidden sm:block overflow-hidden rounded-lg border border-table-border">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <SortableHeader label={t("manager:peopleIndex.prop.name")} field="name" sortField={tSortField} sortDir={tSortDir} onSort={handleTenantSort} />
                        <SortableHeader label={t("manager:peopleIndex.prop.phone")} field="phone" sortField={tSortField} sortDir={tSortDir} onSort={handleTenantSort} />
                        <SortableHeader label={t("manager:peopleIndex.prop.email")} field="email" sortField={tSortField} sortDir={tSortDir} onSort={handleTenantSort} />
                        <SortableHeader label={t("manager:peopleIndex.prop.unit")} field="unit" sortField={tSortField} sortDir={tSortDir} onSort={handleTenantSort} />
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTenants.slice(0, 200).map((tenant) => (
                        <tr key={tenant.id} className="cursor-pointer hover:bg-slate-50/80" onClick={() => router.push(`/manager/people/tenants/${tenant.id}`)}>
                          <td className="cell-bold">{tenant.name || "—"}</td>
                          <td>{tenant.phone || "—"}</td>
                          <td>{tenant.email || "—"}</td>
                          <td>
                            {tenant.unit ? `${tenant.unit.unitNumber}${tenant.unit.floor ? ` (Floor ${tenant.unit.floor})` : ""}` : "—"}
                          </td>
                          <td>
                            <button
                              aria-label={t("manager:peopleIndex.ariaLabel.viewTenant")}
                              onClick={(e) => { e.stopPropagation(); router.push(`/manager/people/tenants/${tenant.id}`); }}
                              className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              </>
            )}
          </div>

          {/* Vendors tab */}
          <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">{t("manager:peopleIndex.text.loadingContractors")}</p>
            ) : contractors.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">{t("manager:peopleIndex.text.noContractorsFound")}</p>
              </div>
            ) : (
              <>
                {/* Mobile card list */}
                <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                  {contractors.slice(0, 200).map((c) => (
                    <div
                      key={c.id}
                      className="table-card cursor-pointer hover:bg-slate-50/80 transition-colors"
                      onClick={() => router.push(`/manager/people/vendors/${c.id}`)}
                    >
                      <p className="table-card-head">{c.name || "—"}</p>
                      {c.hourlyRate != null && (
                        <p className="table-card-sub">CHF {c.hourlyRate}/h</p>
                      )}
                      <div className="table-card-footer">
                        {c.email && <span>{c.email}</span>}
                        {c.phone && <span>{c.phone}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Wide table */}
                <div className="hidden sm:block overflow-hidden rounded-lg border border-table-border">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <SortableHeader label={t("manager:peopleIndex.prop.name")} field="name" sortField={vSortField} sortDir={vSortDir} onSort={handleVendorSort} />
                        <SortableHeader label={t("manager:peopleIndex.prop.phone")} field="phone" sortField={vSortField} sortDir={vSortDir} onSort={handleVendorSort} />
                        <SortableHeader label={t("manager:peopleIndex.prop.email")} field="email" sortField={vSortField} sortDir={vSortDir} onSort={handleVendorSort} />
                        <SortableHeader label={t("manager:peopleIndex.prop.rate")} field="hourlyRate" sortField={vSortField} sortDir={vSortDir} onSort={handleVendorSort} />
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedVendors.slice(0, 200).map((c) => (
                        <tr key={c.id} className="cursor-pointer hover:bg-slate-50/80" onClick={() => router.push(`/manager/people/vendors/${c.id}`)}>
                          <td className="cell-bold">{c.name || "—"}</td>
                          <td>{c.phone || "—"}</td>
                          <td>{c.email || "—"}</td>
                          <td>{c.hourlyRate != null ? `CHF ${c.hourlyRate}/h` : "—"}</td>
                          <td>
                            <button
                              aria-label={t("manager:peopleIndex.ariaLabel.viewVendor")}
                              onClick={(e) => { e.stopPropagation(); router.push(`/manager/people/vendors/${c.id}`); }}
                              className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              </>
            )}
          </div>

          {/* Owners tab */}
          <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
            <OwnersTab showAddForm={showAddOwner} onAddFormClose={() => setShowAddOwner(false)} />
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
