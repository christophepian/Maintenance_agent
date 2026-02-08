import AppShell from "../../../components/AppShell";
import Link from "next/link";

export default function ManagerPeoplePage() {
  return (
    <AppShell role="MANAGER">
      <div className="main-container">
        <h1>People</h1>
        <p className="subtle">Contacts across tenants and vendors.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 16, maxWidth: 320 }}>
          <Link className="button-primary" href="/manager/people/tenants">
            Tenants
          </Link>
          <Link className="button-primary" href="/manager/people/vendors">
            Vendors
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
