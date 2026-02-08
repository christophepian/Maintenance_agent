import AppShell from "../../components/AppShell";
import Link from "next/link";

export default function ManagerAssetsPage() {
  return (
    <AppShell role="MANAGER">
      <div className="main-container">
        <h1>Assets</h1>
        <p className="subtle">Assets map to appliances today. Manage asset models in inventory.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <Link className="button-primary" href="/admin-inventory/asset-models">
            Manage Asset Models
          </Link>
          <Link className="button-secondary" href="/admin-inventory">
            View Inventory
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
