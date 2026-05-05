import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import BuildingFinancialsView from "../../../../components/BuildingFinancialsView";
import { withServerTranslations } from "../../../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function BuildingFinancialsPage() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const { id } = router.query;

  if (!id) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageHeader title={t("manager:buildings[id]Financials.title.buildingFinancials")} />
          <PageContent><p className="loading-text">{t("manager:buildingsIdFinancials.text.loading")}</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title={t("manager:buildings[id]Financials.title.buildingFinancials")} />
        <PageContent>
          <Link href="/manager/finance" className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Back to Finance Dashboard
          </Link>
          <BuildingFinancialsView buildingId={id} />
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common","manager"]);
