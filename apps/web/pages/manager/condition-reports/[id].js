import { useState } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import { ResourceShell, Button, Badge, ErrorBanner } from "../../../components/ui";
import { authHeaders } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { useDetailResource } from "../../../lib/hooks/useDetailResource";
import { useAction } from "../../../lib/hooks/useAction";
import { withServerTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";
import { cn } from "../../../lib/utils";
import { AlertTriangle, CheckCircle2, Image } from "lucide-react";

const STATUS_VARIANT = { PENDING: "warning", SUBMITTED: "info", APPROVED: "success" };
const CONDITION_VARIANT = { GOOD: "success", FAIR: "warning", POOR: "warning", DAMAGED: "destructive" };
const CONDITION_LABEL = { GOOD: "Good", FAIR: "Fair", POOR: "Poor", DAMAGED: "Damaged" };

function ConditionPill({ condition }) {
  return (
    <Badge variant={CONDITION_VARIANT[condition] || "neutral"} size="sm">
      {CONDITION_LABEL[condition] ?? condition}
    </Badge>
  );
}

function ItemsTable({ items, delta, t }) {
  const deltaMap = delta
    ? Object.fromEntries(delta.map((d) => [d.itemId, d]))
    : {};

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const d = deltaMap[item.id];
        const isDelta = d?.isDelta;
        const missingPhoto = isDelta && d.photoCount === 0;

        return (
          <div
            key={item.id}
            className={cn(
              "card border p-3 space-y-2",
              isDelta && "border-warning-ring bg-warning-light/20",
              missingPhoto && "border-destructive-ring",
            )}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {isDelta && (
                  <AlertTriangle className="h-4 w-4 text-warning-text shrink-0" aria-label="Degraded" />
                )}
                <span className="text-xs text-foreground-dim font-medium uppercase tracking-wide">{item.roomLabel}</span>
                <span className="text-sm font-medium text-foreground">{item.itemLabel}</span>
                <ConditionPill condition={item.condition} />
                {d?.moveInCondition && isDelta && (
                  <span className="text-xs text-foreground-dim">
                    (was <ConditionPill condition={d.moveInCondition} />)
                  </span>
                )}
              </div>
              {item.photos?.length > 0 && (
                <span className="text-xs text-foreground-dim shrink-0 flex items-center gap-1">
                  <Image className="h-3.5 w-3.5" />
                  {item.photos.length}
                </span>
              )}
            </div>

            {item.notes && (
              <p className="text-xs text-foreground-dim">{item.notes}</p>
            )}

            {missingPhoto && (
              <p className="text-xs text-destructive-text font-medium">
                ⚠ {t("conditionReport.missingPhotoWarning")}
              </p>
            )}

            {item.photos?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {item.photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={`/api/condition-report-photos/${photo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={`/api/condition-report-photos/${photo.id}`}
                      alt={photo.caption || "Photo"}
                      className="h-16 w-16 object-cover rounded-lg border border-surface-border hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ManagerConditionReportDetail() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const { id, from } = router.query;

  const { data, loading, error, refresh } = useDetailResource(
    id ? `/api/condition-reports/${id}` : null,
  );

  // useDetailResource already unwraps .data — report is the full object directly
  const report = data ?? null;
  const delta = data?.delta ?? null;
  const deltaCount = data?.deltaCount ?? 0;

  const [managerNotes, setManagerNotes] = useState("");
  const [actionError, setActionError] = useState("");
  const { pending, run } = useAction();

  const approve = () => run("approve", async () => {
    setActionError("");
    const res = await fetch(`/api/condition-reports/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ managerNotes: managerNotes.trim() || undefined }),
    });
    const d = await res.json();
    if (!res.ok) { setActionError(d?.error?.message || "Failed"); throw new Error(d?.error?.message); }
    refresh();
  });

  const reopen = () => run("reopen", async () => {
    setActionError("");
    if (!managerNotes.trim()) { setActionError(t("conditionReport.reopenNotesRequired")); return; }
    const res = await fetch(`/api/condition-reports/${id}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ managerNotes: managerNotes.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { setActionError(d?.error?.message || "Failed"); throw new Error(d?.error?.message); }
    refresh();
  });

  const backHref = from ?? (report?.unit ? `/admin-inventory/units/${report.unit.id}` : "/manager/inventory");

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={report
            ? `${report.type === "MOVE_IN" ? t("conditionReport.moveIn") : t("conditionReport.moveOut")} — ${report.unit?.unitNumber ?? ""}`
            : t("conditionReport.title")}
          backLink={{ href: backHref, label: t("conditionReport.backToUnit") }}
          actions={
            report?.status === "SUBMITTED" ? (
              <div className="flex gap-2">
                <Button variant="primary" onClick={approve} disabled={!!pending}>
                  {pending === "approve" ? t("conditionReport.approving") : t("conditionReport.approve")}
                </Button>
                <Button variant="warning" onClick={reopen} disabled={!!pending}>
                  {pending === "reopen" ? t("conditionReport.reopening") : t("conditionReport.reopen")}
                </Button>
              </div>
            ) : null
          }
        />
        <PageContent>
          <ResourceShell loading={loading} error={error} hasData={!!report}>
            {report && (
              <div className="space-y-6 max-w-3xl">
                {actionError && <ErrorBanner error={actionError} />}

                {/* Summary strip */}
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <Badge variant={STATUS_VARIANT[report.status] || "neutral"}>
                    {t(`conditionReport.status_${report.status}`)}
                  </Badge>
                  {report.tenant?.name && (
                    <span className="text-foreground-dim">{report.tenant.name}</span>
                  )}
                  {report.submittedAt && (
                    <span className="text-foreground-dim">{t("conditionReport.submittedOn")} {formatDate(report.submittedAt)}</span>
                  )}
                  {report.approvedAt && (
                    <span className="text-foreground-dim flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      {t("conditionReport.approvedOn")} {formatDate(report.approvedAt)}
                      {report.approvedBy?.name && ` · ${report.approvedBy.name}`}
                    </span>
                  )}
                </div>

                {/* Delta summary for MOVE_OUT */}
                {delta && (
                  <div className={cn(
                    "rounded-xl border p-4",
                    deltaCount > 0 ? "border-warning-ring bg-warning-light/30" : "border-success-ring bg-success-light/30",
                  )}>
                    {deltaCount > 0 ? (
                      <p className="text-sm font-medium text-warning-text">
                        <AlertTriangle className="inline h-4 w-4 mr-1" />
                        {t("conditionReport.deltaCount", { count: deltaCount })}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-success-text">
                        <CheckCircle2 className="inline h-4 w-4 mr-1" />
                        {t("conditionReport.noDelta")}
                      </p>
                    )}
                  </div>
                )}

                {/* Items */}
                <ItemsTable items={report.items ?? []} delta={delta} t={t} />

                {/* Manager notes + actions */}
                {report.status === "SUBMITTED" && (
                  <div className="card border p-4 space-y-3">
                    <label className="block text-sm font-medium text-foreground">
                      {t("conditionReport.managerNotes")}
                    </label>
                    <textarea
                      value={managerNotes}
                      onChange={(e) => setManagerNotes(e.target.value)}
                      rows={3}
                      placeholder={t("conditionReport.managerNotesPlaceholder")}
                      className="input mb-0 resize-none"
                    />
                    <p className="text-xs text-foreground-dim">{t("conditionReport.reopenNotesHint")}</p>
                  </div>
                )}

                {/* Existing manager notes (read-only) */}
                {report.managerNotes && report.status !== "SUBMITTED" && (
                  <div className="rounded-xl border border-brand-ring bg-brand-light p-4">
                    <p className="text-xs font-semibold text-brand mb-1">{t("conditionReport.managerNotes")}</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{report.managerNotes}</p>
                  </div>
                )}
              </div>
            )}
          </ResourceShell>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common", "manager"]);
