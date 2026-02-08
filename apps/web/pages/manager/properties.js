import AppShell from "../../components/AppShell";
import Link from "next/link";

export default function ManagerPropertiesPage() {
  return (
    <AppShell role="MANAGER">
      <div className="main-container">
        <h1>Properties</h1>
        <p className="subtle">
          Properties map to Buildings today. Manage the portfolio through the inventory admin.
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <Link className="button-primary" href="/admin-inventory">
            Open Inventory Admin
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
