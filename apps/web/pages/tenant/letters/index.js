import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import { tenantFetch } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { formatDate } from "../../../lib/format";
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function TenantLetters() {
  const { t } = useTranslation("tenant");
  const router = useRouter();
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantFetch("/api/tenant/letters");
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

  const unreadCount = letters.filter((l) => l.unread).length;

  return (
    <AppShell role="TENANT">
      <PageShell>
        <PageHeader
          title={t("letters.title")}
          subtitle={unreadCount > 0 ? `${unreadCount} ${t("letters.unread")}` : undefined}
        />
        <PageContent>
          {error && <div className="notice notice-err mb-4">{error}</div>}
          {loading ? (
            <p className="loading-text">{t("letters.loading")}</p>
          ) : letters.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">{t("letters.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {letters.map((l) => (
                <div
                  key={l.letterId}
                  onClick={() => router.push(`/tenant/letters/${l.letterId}`)}
                  className={cn("card border px-4 py-3 cursor-pointer hover:bg-surface-subtle transition-colors", l.unread && "border-brand-ring")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {l.unread && (
                          <span className="h-2 w-2 rounded-full bg-brand shrink-0" />
                        )}
                        <p className={cn("text-sm truncate", l.unread ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                          {l.subject}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-foreground-dim shrink-0">{formatDate(l.sentAt)}</span>
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

export const getStaticProps = withTranslations(["common", "tenant"]);
