import AppShell from "../../components/AppShell";
import BillingEntityManager from "../../components/BillingEntityManager";
import { withTranslations } from "../../lib/i18n";

export default function OwnerBillingEntities() {
  return (
    <AppShell role="OWNER">
      <BillingEntityManager title="Owner Billing Entities" />
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","owner"]);
