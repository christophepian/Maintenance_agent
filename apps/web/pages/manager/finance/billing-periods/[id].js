import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import Button from "../../../../components/ui/Button";
import Badge from "../../../../components/ui/Badge";
import { DetailGrid, DetailItem } from "../../../../components/ui/DetailGrid";
import { authHeaders } from "../../../../lib/api";
import { formatChfCents } from "../../../../lib/format";
import { cn } from "../../../../lib/utils";
import { withServerTranslations } from "../../../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function BillingPeriodDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTranslation("manager");

  const [period, setPeriod] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/billing-periods/${id}`, { headers: authHeaders() }),
        fetch(`/api/ancillary-cost-categories`, { headers: authHeaders() }),
      ]);
      const pJson = await pRes.json();
      if (!pRes.ok) throw new Error(pJson.error?.message || "Failed to load");
      setPeriod(pJson.data);
      const cJson = await cRes.json();
      setCategories(Array.isArray(cJson) ? cJson : cJson?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(status) {
    setBusy(true);
    try {
      const res = await fetch(`/api/billing-periods/${id}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed");
      setPeriod(json.data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function deleteEntry(entryId) {
    setBusy(true);
    try {
      const res = await fetch(`/api/billing-periods/${id}/cost-entries/${entryId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed");
      setPeriod(json.data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (loading) return <AppShell><PageShell><PageContent><p className="loading-text">{t("costPool.text.loading")}</p></PageContent></PageShell></AppShell>;
  if (!period) return <AppShell><PageShell><PageContent><p className="error-banner">{error || t("costPool.text.notFound")}</p></PageContent></PageShell></AppShell>;

  const isOpen = period.status === "OPEN";

  return (
    <AppShell>
      <PageShell>
        <PageHeader
          title={`${period.buildingName || ""} · ${period.startDate?.slice(0, 10)} – ${period.endDate?.slice(0, 10)}`}
          backButton={<Link href="/manager/finance/billing-periods" className="text-sm text-muted-text hover:text-foreground">← {t("costPool.title.costPool")}</Link>}
        />
        <PageContent>
          {error && <p className="error-banner">{error}</p>}

          <Panel
            title={t("costPool.title.summary")}
            actions={
              isOpen ? (
                <Button variant="secondary" size="sm" onClick={() => setStatus("CLOSED")} disabled={busy}>{t("costPool.action.close")}</Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setStatus("OPEN")} disabled={busy}>{t("costPool.action.reopen")}</Button>
              )
            }
          >
            <DetailGrid>
              <DetailItem label={t("costPool.field.status")}>
                <Badge variant={isOpen ? "info" : "success"} size="sm">{t(`costPool.status.${period.status.toLowerCase()}`)}</Badge>
              </DetailItem>
              <DetailItem label={t("costPool.col.totalCosts")}>{formatChfCents(period.totalCostsCents)}</DetailItem>
              <DetailItem label={t("costPool.col.billable")}>{formatChfCents(period.totalBillableCostsCents)}</DetailItem>
              <DetailItem label={t("costPool.field.adminFeePct")}>{(period.adminFeeRatePermille / 10).toFixed(1)}%</DetailItem>
            </DetailGrid>
          </Panel>

          <div className="mt-6">
            <Panel title={t("costPool.title.costEntries")}>
              {period.costEntries.length === 0 ? (
                <p className="empty-state-text py-4 text-center italic">{t("costPool.text.noCostEntries")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>{t("costPool.col.category")}</th>
                        <th className="text-right">{t("costPool.col.amount")}</th>
                        <th>{t("costPool.col.note")}</th>
                        {isOpen && <th className="text-right">{t("costPool.col.actions")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {period.costEntries.map((e) => (
                        <tr key={e.id} className="border-t border-surface-divider">
                          <td>
                            {e.categoryName}
                            {e.billability === "NON_BILLABLE" && (
                              <span className="ml-2 text-xs text-muted-text">({t("costPool.text.nonBillable")})</span>
                            )}
                          </td>
                          <td className="text-right tabular-nums">{formatChfCents(e.amountCents)}</td>
                          <td className="text-muted-text">{e.note || "—"}</td>
                          {isOpen && (
                            <td className="text-right">
                              <Button variant="destructiveGhost" size="xs" onClick={() => deleteEntry(e.id)} disabled={busy}>{t("costPool.action.delete")}</Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isOpen && (
                <AddCostEntryForm
                  periodId={id}
                  categories={categories}
                  onAdded={(updated) => setPeriod(updated)}
                  t={t}
                />
              )}
            </Panel>
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

function AddCostEntryForm({ periodId, categories, onAdded, t }) {
  const [categoryId, setCategoryId] = useState("");
  const [amountChf, setAmountChf] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!categoryId || !amountChf) return;
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/billing-periods/${periodId}/cost-entries`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          amountCents: Math.round(parseFloat(amountChf) * 100),
          note: note || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed");
      onAdded(json.data);
      setCategoryId(""); setAmountChf(""); setNote("");
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="mt-4 border-t border-surface-divider pt-4">
      {err && <p className="error-banner mb-2">{err}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-muted-text mb-1">{t("costPool.col.category")}</label>
          <select className="w-full border border-surface-border rounded-lg px-2 py-1.5 text-sm bg-surface" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t("costPool.text.selectCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.billability === "NON_BILLABLE" ? ` (${t("costPool.text.nonBillable")})` : ""}</option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-muted-text mb-1">{t("costPool.col.amount")} (CHF)</label>
          <input type="number" step="0.01" min="0" className="w-full border border-surface-border rounded-lg px-2 py-1.5 text-sm" value={amountChf} onChange={(e) => setAmountChf(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-muted-text mb-1">{t("costPool.col.note")}</label>
          <input type="text" className="w-full border border-surface-border rounded-lg px-2 py-1.5 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button variant="primary" size="sm" onClick={submit} disabled={saving || !categoryId || !amountChf}>
          {saving ? t("costPool.text.saving") : t("costPool.action.addCostEntry")}
        </Button>
      </div>
    </div>
  );
}

export const getServerSideProps = withServerTranslations(["common", "manager"]);
