import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Badge from "../../../components/ui/Badge";
import { authHeaders } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

const TEMPLATE_LABELS = {
  GENERAL: "Général",
  MAINTENANCE_NOTICE: "Maintenance",
  COMPLIANCE_REQUEST: "Conformité",
  FINANCIAL_NOTICE: "Finances",
  SEASONAL: "Saisonnier",
  LEASE_ADMIN: "Bail",
};

const STATUS_VARIANT = { DRAFT: "warning", SENT: "success", ARCHIVED: "neutral" };

export default function CorrespondenceIndex() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/correspondence", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load");
      setLetters(data?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={t("correspondence.title")}
          subtitle={t("correspondence.subtitle")}
          actions={
            <button
              onClick={() => router.push("/manager/correspondence/new")}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
            >
              {t("correspondence.newLetter")}
            </button>
          }
        />
        <PageContent>
          {error && <div className="notice notice-err mb-4">{error}</div>}
          {loading ? (
            <p className="loading-text">{t("correspondence.loading")}</p>
          ) : letters.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">{t("correspondence.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {letters.map((l) => (
                <div
                  key={l.id}
                  onClick={() => router.push(`/manager/correspondence/${l.id}`)}
                  className="card border px-4 py-3 cursor-pointer hover:bg-surface-subtle transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{l.subject || t("correspondence.untitled")}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={STATUS_VARIANT[l.status] || "neutral"} size="sm">
                          {t(`correspondence.status.${l.status.toLowerCase()}`)}
                        </Badge>
                        <span className="text-xs text-foreground-dim">{TEMPLATE_LABELS[l.templateType] || l.templateType}</span>
                        {l.status === "SENT" && (
                          <span className="text-xs text-foreground-dim">
                            {l.recipientCount} {t("correspondence.recipients")}
                            {l.responseCount > 0 && ` · ${l.responseCount} ${t("correspondence.replies")}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-foreground-dim shrink-0">
                      {l.sentAt ? formatDate(l.sentAt) : formatDate(l.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common", "manager"]);
