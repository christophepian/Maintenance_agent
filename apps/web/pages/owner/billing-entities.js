import AppShell from "../../components/AppShell";
import BillingEntityManager from "../../components/BillingEntityManager";

export default function OwnerBillingEntities() {
  return (
    <AppShell role="OWNER">
      <BillingEntityManager title="Owner Billing Entities" />
    </AppShell>
  );
}
