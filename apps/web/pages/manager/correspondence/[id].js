import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Badge from "../../../components/ui/Badge";
import { authHeaders } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { formatDate } from "../../../lib/format";
import { withServerTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

const STATUS_VARIANT = { DRAFT: "warning", SENT: "success", ARCHIVED: "neutral" };

export default function LetterDetail() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const { id } = router.query;
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/correspondence/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load");
      setLetter(data.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const deleteDraft = async () => {
    if (!confirm(t("correspondence.confirmDelete"))) return;
    setDeleting(true);
    try {
      await fetch(`/api/correspondence/${id}`, { method: "DELETE", headers: authHeaders() });
      router.push("/manager/correspondence");
    } catch (e) {
      setError(String(e?.message || e));
      setDeleting(false);
    }
  };

  if (loading) return (
    <AppShell role="MANAGER">
      <PageShell><PageContent><p className="loading-text">{t("correspondence.loading")}</p></PageContent></PageShell>
    </AppShell>
  );

  if (!letter) return (
    <AppShell role="MANAGER">
      <PageShell><PageContent><div className="notice notice-err">{error || t("correspondence.notFound")}</div></PageContent></PageShell>
    </AppShell>
  );

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={letter.subject || t("correspondence.untitled")}
          actions={
            letter.status === "DRAFT" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/manager/correspondence/new?edit=${id}`)}
                  className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-muted-dark hover:bg-surface-subtle transition-colors"
                >
                  {t("correspondence.edit")}
                </button>
                <button
                  onClick={deleteDraft}
                  disabled={deleting}
                  className="rounded-lg border border-destructive-ring px-4 py-2 text-sm font-medium text-destructive-text hover:bg-destructive-light disabled:opacity-50 transition-colors"
                >
                  {t("correspondence.delete")}
                </button>
              </div>
            ) : null
          }
        />
        <PageContent>
          {error && <div className="notice notice-err mb-4">{error}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            {/* ── Letter body ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={STATUS_VARIANT[letter.status] || "neutral"} size="sm">
                  {t(`correspondence.status.${letter.status.toLowerCase()}`)}
                </Badge>
                {letter.sentAt && (
                  <span className="text-xs text-foreground-dim">{t("correspondence.sentOn")} {formatDate(letter.sentAt)}</span>
                )}
              </div>

              <div className="card border p-5 whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
                {letter.body || <span className="text-foreground-dim italic">{t("correspondence.emptyBody")}</span>}
              </div>

              {/* Responses thread */}
              {letter.responses?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground-dim">{t("correspondence.replies")}</p>
                  {letter.responses.map((r) => (
                    <div key={r.id} className="card border p-4 bg-surface-subtle">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">{r.tenant?.name || t("correspondence.tenant")}</span>
                        <span className="text-xs text-foreground-dim">{formatDate(r.createdAt)}</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Recipients ── */}
            <div className="card border p-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                {t("correspondence.recipients")} ({letter.recipients?.length || 0})
              </p>
              <div className="space-y-2">
                {(letter.recipients || []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{r.tenant?.name || r.tenant?.email || r.tenantId}</p>
                      {r.tenant?.email && (
                        <p className="text-xs text-foreground-dim truncate">{r.tenant.email}</p>
                      )}
                    </div>
                    <span className={cn("shrink-0 text-xs px-1.5 py-0.5 rounded-full", r.readAt ? "bg-success-light text-success" : "bg-surface-hover text-muted-text")}>
                      {r.readAt ? t("correspondence.read") : t("correspondence.unread")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common", "manager"]);
