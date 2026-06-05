import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import { tenantFetch } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { withServerTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function TenantLetterDetail() {
  const { t } = useTranslation("tenant");
  const router = useRouter();
  const { id } = router.query;
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await tenantFetch(`/api/tenant/letters/${id}`);
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

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await tenantFetch(`/api/tenant/letters/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to send");
      setReply("");
      setSent(true);
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <AppShell role="TENANT">
      <PageShell><PageContent><p className="loading-text">{t("letters.loading")}</p></PageContent></PageShell>
    </AppShell>
  );

  if (!letter) return (
    <AppShell role="TENANT">
      <PageShell><PageContent>
        <div className="notice notice-err">{error || t("letters.notFound")}</div>
      </PageContent></PageShell>
    </AppShell>
  );

  return (
    <AppShell role="TENANT">
      <PageShell>
        <PageHeader title={letter.subject} />
        <PageContent>
          {error && <div className="notice notice-err mb-4">{error}</div>}

          <div className="max-w-2xl space-y-6">
            {/* Letter metadata */}
            <div className="flex items-center gap-3 text-xs text-foreground-dim">
              <span>{t("letters.from")}: {t("letters.propertyManager")}</span>
              <span>·</span>
              <span>{formatDate(letter.sentAt)}</span>
            </div>

            {/* Letter body */}
            <div className="card border p-5 whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {letter.body}
            </div>

            {/* Previous replies */}
            {letter.responses?.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-dim">{t("letters.yourReplies")}</p>
                {letter.responses.map((r) => (
                  <div key={r.id} className="card border p-4 bg-surface-subtle">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{t("letters.you")}</span>
                      <span className="text-xs text-foreground-dim">{formatDate(r.createdAt)}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{r.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reply form */}
            {sent ? (
              <div className="rounded-xl bg-success-light border border-success-ring p-4 text-sm text-success-text">
                {t("letters.replySent")}
              </div>
            ) : (
              <div className="card border p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">{t("letters.replyTitle")}</p>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={5}
                  placeholder={t("letters.replyPlaceholder")}
                  className="input mb-0 resize-none"
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition-colors"
                >
                  {sending ? t("letters.sending") : t("letters.sendReply")}
                </button>
              </div>
            )}
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common", "tenant"]);
