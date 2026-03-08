import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Link from "next/link";

const FINANCE_LINKS = [
  { href: "/manager/finance/invoices", label: "Invoices & Bills" },
  { href: "/manager/finance/payments", label: "Payments" },
  { href: "/manager/finance/expenses", label: "Expenses" },
  { href: "/manager/finance/charges", label: "Charges" },
  { href: "/manager/finance/billing-entities", label: "Billing Entities" },
  { href: "/manager/finance/ledger", label: "Ledger" },
];

export default function ManagerFinanceHome() {
  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Finance" />
        <PageContent>
          <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
            {FINANCE_LINKS.map((link) => (
              <Link key={link.href} className="button-primary" href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
