import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
import NotificationPreferencesTab from "../../components/NotificationPreferencesTab";
import AppearanceTab from "../../components/AppearanceTab";
import { tenantHeaders } from "../../lib/api";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { useCallback } from "react";

const TAB_KEYS = ["notifications", "appearance"];

const EVENT_GROUPS = [
  {
    groupKey: "requests",
    events: ["REQUEST_APPROVED", "REJECTED", "TENANT_SELF_PAY_ACCEPTED"],
  },
  {
    groupKey: "jobs",
    events: ["JOB_STARTED", "JOB_COMPLETED"],
  },
  {
    groupKey: "leases",
    events: ["LEASE_READY_TO_SIGN", "LEASE_SIGNED"],
  },
  {
    groupKey: "scheduling",
    events: ["SLOT_PROPOSED", "SLOT_DECLINED"],
  },
];

export default function TenantSettingsPage() {
  const { t } = useTranslation("tenant");
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
    <AppShell role="TENANT">
      <PageShell>
        <PageHeader
          title={t("tenant:settings.title")}
          subtitle={t("tenant:settings.subtitle")}
        />
        <PageContent>
          <ScrollableTabs activeIndex={activeTab}>
            {TAB_KEYS.map((key, i) => (
              <button
                key={key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {t(`tenant:settings.tabs.${key}`)}
              </button>
            ))}
          </ScrollableTabs>

          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            <NotificationPreferencesTab
              authHeaders={tenantHeaders}
              eventGroups={EVENT_GROUPS}
              t={t}
              ns="tenant"
            />
          </div>

          <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
            <AppearanceTab t={t} ns="tenant" />
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common", "tenant"]);
