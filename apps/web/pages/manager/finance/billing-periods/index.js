import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import Button from "../../../../components/ui/Button";
import Badge from "../../../../components/ui/Badge";
import { Modal, ModalFooter } from "../../../../components/ui/Modal";
import { authHeaders } from "../../../../lib/api";
import { formatChfCents } from "../../../../lib/format";
import { cn } from "../../../../lib/utils";
import { withTranslations } from "../../../../lib/i18n";
import { useTranslation } from "next-i18next";

function periodVariant(status) {
  return status === "CLOSED" ? "success" : "info";
}

export default function BillingPeriodsPage() {
  const router = useRouter();
  const { t } = useTranslation("manager");

  const [buildings, setBuildings] = useState([]);
  const [buildingId, setBuildingId] = useState("");
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetch("/api/buildings", { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const list = Array.isArray(j) ? j : j?.data || [];
        setBuildings(list);
        if (list.length && !buildingId) setBuildingId(list[0].id);
      })
      .catch(() => setError(t("costPool.text.failedLoadBuildings")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPeriods = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/billing-periods?buildingId=${buildingId}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load");
      setPeriods(json.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  return (
    <AppShell>
      <PageShell>
        <PageHeader title={t("costPool.title.costPool")} />
        <PageContent>
          {error && <p className="error-banner">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-text">{t("costPool.field.building")}</label>
              <select
                className="border border-surface-border rounded-lg px-3 py-1.5 text-sm bg-surface"
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} disabled={!buildingId}>
              {t("costPool.action.newPeriod")}
            </Button>
          </div>

          {loading ? (
            <p className="loading-text">{t("costPool.text.loading")}</p>
          ) : periods.length === 0 ? (
            <Panel>
              <p className="empty-state-text py-6 text-center italic">{t("costPool.text.noPeriods")}</p>
            </Panel>
          ) : (
            <div className="space-y-2">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/manager/finance/billing-periods/${p.id}`)}
                  className="w-full text-left rounded-2xl border border-surface-border bg-surface-raised px-4 py-3 hover:bg-surface-subtle transition flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {p.startDate?.slice(0, 10)} – {p.endDate?.slice(0, 10)}
                    </p>
                    <p className="text-xs text-muted-text mt-0.5">
                      {t("costPool.text.billableOfTotal", {
                        billable: formatChfCents(p.totalBillableCostsCents),
                        total: formatChfCents(p.totalCostsCents),
                      })}
                    </p>
                  </div>
                  <Badge variant={periodVariant(p.status)} size="sm">{t(`costPool.status.${p.status.toLowerCase()}`)}</Badge>
                </button>
              ))}
            </div>
          )}
        </PageContent>
      </PageShell>

      {showCreate && (
        <CreatePeriodModal
          buildingId={buildingId}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); router.push(`/manager/finance/billing-periods/${id}`); }}
          t={t}
        />
      )}
    </AppShell>
  );
}

function CreatePeriodModal({ buildingId, onClose, onCreated, t }) {
  const year = new Date().getFullYear() - 1;
  const [startDate, setStartDate] = useState(`${year}-01-01`);
  const [endDate, setEndDate] = useState(`${year}-12-31`);
  const [adminFeePct, setAdminFeePct] = useState("0");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setSaving(true);
    setErr("");
    try {
      const adminFeeRatePermille = Math.round(parseFloat(adminFeePct || "0") * 10); // % → permille
      const res = await fetch("/api/billing-periods", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId, startDate, endDate, adminFeeRatePermille }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to create");
      onCreated(json.data.id);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={t("costPool.action.newPeriod")} onClose={onClose}>
      {err && <p className="error-banner mb-3">{err}</p>}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("costPool.field.startDate")}</label>
          <input type="date" className="w-full border border-surface-border rounded-lg px-3 py-1.5 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("costPool.field.endDate")}</label>
          <input type="date" className="w-full border border-surface-border rounded-lg px-3 py-1.5 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("costPool.field.adminFeePct")}</label>
          <input type="number" step="0.1" min="0" max="3" className="w-full border border-surface-border rounded-lg px-3 py-1.5 text-sm" value={adminFeePct} onChange={(e) => setAdminFeePct(e.target.value)} />
          <p className="text-xs text-muted-text mt-1">{t("costPool.text.adminFeeHint")}</p>
        </div>
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{t("costPool.action.cancel")}</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>
          {saving ? t("costPool.text.saving") : t("costPool.action.create")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export const getStaticProps = withTranslations(["common", "manager"]);
