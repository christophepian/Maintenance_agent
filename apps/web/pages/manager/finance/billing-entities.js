import AppShell from "../../../components/AppShell";
import BillingEntityManager from "../../../components/BillingEntityManager";

export default function ManagerBillingEntities() {
  return (
    <AppShell role="MANAGER">
      <BillingEntityManager title="Billing Entities" />
    </AppShell>
  );
}
