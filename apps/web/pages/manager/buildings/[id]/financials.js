import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import BuildingFinancialsView from "../../../../components/BuildingFinancialsView";

export default function BuildingFinancialsPage() {
  const router = useRouter();
  const { id } = router.query;

  if (!id) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageHeader title="Building Financials" />
          <PageContent><p className="loading-text">Loading…</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Building Financials" />
        <PageContent>
          <Link href="/manager/finance" className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Back to Finance Dashboard
          </Link>
          <BuildingFinancialsView buildingId={id} />
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
