import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import DepreciationStandards from "../../../components/DepreciationStandards";

export default function DepreciationStandardsPage() {
  return (
    <AppShell role="MANAGER">
      <PageShell>
        <div className="px-4 pt-4">
          <Link href="/manager/legal" className="text-sm text-blue-600 hover:text-blue-800">← Legal</Link>
        </div>
        <PageHeader
          title="Depreciation Standards"
          subtitle="Swiss industry-standard useful-life schedules — ASLOCA/FRI joint table (2007)"
        />
        <PageContent>
          <DepreciationStandards />
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
