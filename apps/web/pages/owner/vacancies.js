import { useState } from "react";
import AppShell from "../../components/AppShell";
import OwnerPicker from "../../components/OwnerPicker";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import VacanciesPanel from "../../components/VacanciesPanel";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function OwnerVacanciesPage() {
  const { t } = useTranslation("owner");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <OwnerPicker onSelect={() => setRefreshKey((k) => k + 1)} />
        <PageHeader
          title={t("owner:vacancies.title.vacancies")}
          subtitle="Vacant units open for rental applications"
          actions={
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          }
        />

        <PageContent>
          <VacanciesPanel role="OWNER" refreshKey={refreshKey} />
        </PageContent>
      </PageShell>
    </AppShell>
  );
}


export const getStaticProps = withTranslations(["common","owner"]);
