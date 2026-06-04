import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import { ResourceShell } from "../../../components/ui";
import Badge from "../../../components/ui/Badge";
import { tenantFetch } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { useDetailResource } from "../../../lib/hooks/useDetailResource";
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";
import { cn } from "../../../lib/utils";

const STATUS_VARIANT = {
  PENDING: "warning",
  SUBMITTED: "info",
  APPROVED: "success",
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
  return diff;
}

export default function TenantConditionReports() {
  const { t } = useTranslation("tenant");
  const router = useRouter();

  const { data, loading, error } = useDetailResource(
    "/api/tenant/condition-reports",
    tenantFetch,
  );

  const reports = data?.data ?? [];

  return (
    <AppShell role="TENANT">
      <PageShell>
        <PageHeader
          title={t("conditionReport.title")}
          subtitle={t("conditionReport.subtitle")}
        />
        <PageContent>
          <ResourceShell loading={loading} error={error}>
            {reports.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">{t("conditionReport.empty")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => {
                  const days = daysUntil(r.dueAt);
                  const isOverdue = days !== null && days < 0 && r.status === "PENDING";
                  return (
                    <div
                      key={r.id}
                      onClick={() => router.push(`/tenant/condition-reports/${r.id}`)}
                      className={cn(
                        "card border px-4 py-3 cursor-pointer hover:bg-surface-subtle transition-colors",
                        isOverdue && "border-destructive-ring",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={STATUS_VARIANT[r.status] || "neutral"} size="sm">
                              {t(`conditionReport.status.${r.status}`)}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">
                              {t(`conditionReport.type.${r.type}`)}
                            </span>
                            {r.unit && (
                              <span className="text-xs text-foreground-dim">
                                {t("conditionReport.unit", { defaultValue: "Unit" })} {r.unit?.unitNumber ?? ""}
                              </span>
                            )}
                          </div>
                          {r.status === "PENDING" && r.dueAt && (
                            <p className={cn("text-xs", isOverdue ? "text-destructive-text font-medium" : "text-foreground-dim")}>
                              {isOverdue
                                ? t("conditionReport.overdue")
                                : t("conditionReport.dueIn", { days })}
                            </p>
                          )}
                          <p className="text-xs text-foreground-dim">
                            {r.itemCount} {t("conditionReport.items")}
                          </p>
                        </div>
                        <span className="text-xs text-foreground-dim shrink-0">
                          {formatDate(r.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ResourceShell>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common", "tenant"]);
