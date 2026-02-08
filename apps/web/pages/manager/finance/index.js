import AppShell from "../../../components/AppShell";
import Link from "next/link";

export default function ManagerFinanceHome() {
  return (
    <AppShell role="MANAGER">
      <div className="main-container">
        <h1>Finance</h1>
        <p className="subtle">Finance modules are placeholders for now.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 16, maxWidth: 360 }}>
          <Link className="button-primary" href="/manager/finance/charges">
            Charges
          </Link>
          <Link className="button-primary" href="/manager/finance/payments">
            Payments
          </Link>
          <Link className="button-primary" href="/manager/finance/invoices">
            Invoices & Bills
          </Link>
          <Link className="button-primary" href="/manager/finance/expenses">
            Expenses
          </Link>
          <Link className="button-primary" href="/manager/finance/ledger">
            Ledger
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
