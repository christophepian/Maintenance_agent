import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
import NotificationPreferencesTab from "../../components/NotificationPreferencesTab";
import { contractorAuthHeaders } from "../../lib/api";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { useCallback } from "react";

const TAB_KEYS = ["notifications"];

const EVENT_GROUPS = [
  {
    groupKey: "assignments",
    events: ["CONTRACTOR_ASSIGNED", "JOB_CREATED"],
  },
  {
    groupKey: "quotes",
    events: ["QUOTE_AWARDED", "QUOTE_REJECTED"],
  },
  {
    groupKey: "scheduling",
    events: ["SLOT_PROPOSED", "SLOT_ACCEPTED", "SLOT_DECLINED", "JOB_CONFIRMED"],
  },
  {
    groupKey: "invoices",
    events: ["INVOICE_PAID"],
  },
];

export default function ContractorSettingsPage() {
  const { t } = useTranslation("contractor");
  const router = useRouter();
  const activeTab = router.isReady ? (Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true },
    );
  }, [router]);

  return (
    <AppShell role="CONTRACTOR">
      <PageShell>
        <PageHeader
          title={t("contractor:settings.title")}
          subtitle={t("contractor:settings.subtitle")}
        />
        <PageContent>
          <ScrollableTabs activeIndex={activeTab}>
            {TAB_KEYS.map((key, i) => (
              <button
                key={key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {t(`contractor:settings.tabs.${key}`)}
              </button>
            ))}
          </ScrollableTabs>

          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            <NotificationPreferencesTab
              authHeaders={contractorAuthHeaders}
              eventGroups={EVENT_GROUPS}
              t={t}
              ns="contractor"
            />
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common", "contractor"]);
