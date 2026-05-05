import AppShell from "../../components/AppShell";
import BillingEntityManager from "../../components/BillingEntityManager";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function OwnerBillingEntities() {
  const { t } = useTranslation("owner");
  return (
    <AppShell role="OWNER">
      <BillingEntityManager title={t("owner:billingEntities.title.ownerBillingEntities")} />
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","owner"]);
