import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import BillingEntityManager from "../../../../components/BillingEntityManager";
import { withTranslations } from "../../../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function ManagerBillingEntities() {
  const { t } = useTranslation("manager");
  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title={t("manager:financeBillingEntitiesIndex.title.billingEntities")} />
        <PageContent>
          <BillingEntityManager />
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
