import AppShell from "../../components/AppShell";
import Link from "next/link";

export default function ManagerSettingsPage() {
  return (
    <AppShell role="MANAGER">
      <div className="main-container">
        <h1>Settings</h1>
        <p className="subtle">Org configuration lives in the manager dashboard for now.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <Link className="button-primary" href="/manager/work-requests">
            Open Work Requests Dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
