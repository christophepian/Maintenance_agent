import AppShell from "../../components/AppShell";
import ManagerDashboard from "../manager";

export default function ManagerWorkRequestsPage() {
  return (
    <AppShell role="MANAGER">
      <ManagerDashboard />
    </AppShell>
  );
}
