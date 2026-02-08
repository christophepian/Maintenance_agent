import AppShell from "../../components/AppShell";
import ManagerDashboard from "../manager";

export default function ManagerRequestsPage() {
  return (
    <AppShell role="MANAGER">
      <ManagerDashboard />
    </AppShell>
  );
}
