import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import BillingEntityManager from "../../../../components/BillingEntityManager";

export default function ManagerBillingEntities() {
  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Billing Entities" />
        <PageContent>
          <BillingEntityManager />
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
