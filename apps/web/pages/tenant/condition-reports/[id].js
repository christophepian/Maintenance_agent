import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import { ResourceShell, Button, Badge, ErrorBanner } from "../../../components/ui";
import { tenantFetch } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { useDetailResource } from "../../../lib/hooks/useDetailResource";
import { useAction } from "../../../lib/hooks/useAction";
import { withServerTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";
import { cn } from "../../../lib/utils";

const CONDITIONS = ["GOOD", "FAIR", "POOR", "DAMAGED"];

const STATUS_VARIANT = { PENDING: "warning", SUBMITTED: "info", APPROVED: "success" };
const CONDITION_VARIANT = { GOOD: "success", FAIR: "warning", POOR: "warning", DAMAGED: "destructive" };

function ItemForm({ reportId, onSaved, t }) {
  const [roomLabel, setRoomLabel] = useState("");
  const [itemLabel, setItemLabel] = useState("");
  const [condition, setCondition] = useState("GOOD");
  const [notes, setNotes] = useState("");
  const { pending, run } = useAction();
  const [error, setError] = useState("");

  const save = async () => {
    if (!roomLabel.trim() || !itemLabel.trim()) {
      setError("Room and item labels are required.");
      return;
    }
    setError("");
    await run(async () => {
      const res = await tenantFetch(`/api/tenant/condition-reports/${reportId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomLabel, itemLabel, condition, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to save");
      setRoomLabel(""); setItemLabel(""); setCondition("GOOD"); setNotes("");
      onSaved();
    });
  };

  return (
    <div className="card border p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t("conditionReport.addItem")}</p>
      {error && <ErrorBanner error={error} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-dark mb-1">{t("conditionReport.roomLabel")}</label>
          <input
            type="text"
            value={roomLabel}
            onChange={(e) => setRoomLabel(e.target.value)}
            placeholder={t("conditionReport.roomPlaceholder")}
            className="input mb-0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-dark mb-1">{t("conditionReport.itemLabel")}</label>
          <input
            type="text"
            value={itemLabel}
            onChange={(e) => setItemLabel(e.target.value)}
            placeholder={t("conditionReport.itemPlaceholder")}
            className="input mb-0"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-dark mb-1">{t("conditionReport.condition")}</label>
        <div className="flex gap-2 flex-wrap">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCondition(c)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                condition === c
                  ? "bg-brand text-white border-brand"
                  : "border-surface-border text-foreground hover:bg-surface-subtle",
              )}
            >
              {t(`conditionReport.condition_${c}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-dark mb-1">{t("conditionReport.notes")}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={t("conditionReport.notesPlaceholder")}
          className="input mb-0 resize-none"
        />
      </div>
      <Button variant="primary" onClick={save} disabled={pending} className="w-full sm:w-auto">
        {pending ? t("conditionReport.saving") : t("conditionReport.saveItem")}
      </Button>
    </div>
  );
}

function ItemRow({ item, reportId, editable, onDeleted, onUpdated, t }) {
  const { pending, run } = useAction();
  const [expanded, setExpanded] = useState(false);
  const [editCondition, setEditCondition] = useState(item.condition);
  const [editNotes, setEditNotes] = useState(item.notes ?? "");
  const [error, setError] = useState("");

  const del = async () => {
    await run("del", async () => {
      const res = await tenantFetch(`/api/tenant/condition-reports/${reportId}/items/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      onDeleted(item.id);
    });
  };

  const update = async () => {
    setError("");
    await run("update", async () => {
      const res = await tenantFetch(`/api/tenant/condition-reports/${reportId}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: editCondition, notes: editNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to update");
      setExpanded(false);
      onUpdated({ ...item, condition: editCondition, notes: editNotes });
    });
  };

  return (
    <div className="card border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-foreground-dim font-medium uppercase tracking-wide">{item.roomLabel}</span>
            <span className="text-sm font-medium text-foreground">{item.itemLabel}</span>
            <Badge variant={CONDITION_VARIANT[item.condition] || "neutral"} size="sm">
              {t(`conditionReport.condition_${item.condition}`)}
            </Badge>
          </div>
          {item.notes && <p className="text-xs text-foreground-dim mt-0.5">{item.notes}</p>}
        </div>
        {editable && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-brand hover:underline"
            >
              Edit
            </button>
            <button
              onClick={del}
              disabled={pending === "del"}
              className="text-xs text-destructive-text hover:underline disabled:opacity-50"
            >
              {t("conditionReport.deleteItem")}
            </button>
          </div>
        )}
      </div>

      {expanded && editable && (
        <div className="space-y-2 pt-2 border-t border-surface-divider">
          {error && <ErrorBanner error={error} />}
          <div className="flex gap-2 flex-wrap">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEditCondition(c)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium border transition-colors",
                  editCondition === c
                    ? "bg-brand text-white border-brand"
                    : "border-surface-border text-foreground hover:bg-surface-subtle",
                )}
              >
                {t(`conditionReport.condition_${c}`)}
              </button>
            ))}
          </div>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={2}
            placeholder={t("conditionReport.notesPlaceholder")}
            className="input mb-0 resize-none text-sm"
          />
          <div className="flex gap-2">
            <Button variant="primary" onClick={update} disabled={!!pending} className="text-xs">
              {pending === "update" ? t("conditionReport.saving") : t("conditionReport.saveItem")}
            </Button>
            <Button variant="ghost" onClick={() => setExpanded(false)} className="text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TenantConditionReportDetail() {
  const { t } = useTranslation("tenant");
  const router = useRouter();
  const { id } = router.query;

  const { data, loading, error, refresh } = useDetailResource(
    id ? `/api/tenant/condition-reports/${id}` : null,
    (url) => tenantFetch(url).then((r) => r.json()),
  );

  const report = data?.data ?? null;
  const [items, setItems] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const { pending: submitting, run: runSubmit } = useAction();

  // Use server items initially, local state after edits
  const displayItems = items ?? report?.items ?? [];

  const handleItemSaved = useCallback(() => {
    refresh();
    setItems(null);
  }, [refresh]);

  const handleItemDeleted = useCallback((itemId) => {
    setItems((prev) => (prev ?? report?.items ?? []).filter((i) => i.id !== itemId));
  }, [report]);

  const handleItemUpdated = useCallback((updated) => {
    setItems((prev) => (prev ?? report?.items ?? []).map((i) => i.id === updated.id ? updated : i));
  }, [report]);

  const submit = async () => {
    if (!confirm(t("conditionReport.submitConfirm"))) return;
    setSubmitError("");
    await runSubmit(async () => {
      const res = await tenantFetch(`/api/tenant/condition-reports/${id}/submit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || "Failed to submit";
        setSubmitError(msg);
        throw new Error(msg);
      }
      router.push("/tenant/condition-reports");
    });
  };

  const editable = report?.status === "PENDING";

  return (
    <AppShell role="TENANT">
      <PageShell>
        <PageHeader
          title={report ? `${t(`conditionReport.type.${report.type}`)} — ${t(`conditionReport.status.${report.status}`)}` : t("conditionReport.title")}
          backLink={{ href: "/tenant/condition-reports", label: t("conditionReport.title") }}
          actions={
            editable ? (
              <Button variant="primary" onClick={submit} disabled={!!submitting}>
                {submitting ? t("conditionReport.submitting") : t("conditionReport.submit")}
              </Button>
            ) : null
          }
        />
        <PageContent>
          <ResourceShell loading={loading} error={error} notFound={!loading && !report}>
            {report && (
              <div className="space-y-6 max-w-2xl">
                {submitError && <ErrorBanner error={submitError} />}

                {/* Metadata strip */}
                <div className="flex items-center gap-3 flex-wrap text-xs text-foreground-dim">
                  <Badge variant={STATUS_VARIANT[report.status] || "neutral"} size="sm">
                    {t(`conditionReport.status.${report.status}`)}
                  </Badge>
                  {report.dueAt && editable && (
                    <span>{t("conditionReport.dueIn", { days: Math.ceil((new Date(report.dueAt) - Date.now()) / 86400000) })}</span>
                  )}
                  {report.approvedAt && (
                    <span>{t("conditionReport.approvedOn", { date: formatDate(report.approvedAt) })}</span>
                  )}
                </div>

                {/* Manager notes (visible after reopen or approve) */}
                {report.managerNotes && (
                  <div className="rounded-xl border border-brand-ring bg-brand-light p-4">
                    <p className="text-xs font-semibold text-brand mb-1">{t("conditionReport.managerNotes")}</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{report.managerNotes}</p>
                  </div>
                )}

                {/* Item list */}
                <div className="space-y-2">
                  {displayItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      reportId={id}
                      editable={editable}
                      onDeleted={handleItemDeleted}
                      onUpdated={handleItemUpdated}
                      t={t}
                    />
                  ))}
                  {displayItems.length === 0 && (
                    <p className="text-sm text-foreground-dim italic py-4 text-center">
                      No items yet. Add rooms and items below.
                    </p>
                  )}
                </div>

                {/* Add item form */}
                {editable && (
                  <ItemForm reportId={id} onSaved={handleItemSaved} t={t} />
                )}
              </div>
            )}
          </ResourceShell>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common", "tenant"]);
