import AppShell from "../../../components/AppShell";
import InventoryAdmin from "../../admin-inventory";

export default function ManagerInventoryPage() {
  return (
    <AppShell role="MANAGER">
      <InventoryAdmin />
    </AppShell>
  );
}
