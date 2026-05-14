import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import BuildingFinancialsView from "../../../../components/BuildingFinancialsView";
import { withServerTranslations } from "../../../../lib/i18n";
import { authHeaders } from "../../../../lib/api";

export default function BuildingFinancialsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [buildingName, setBuildingName] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/buildings/${id}`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        const name = json?.data?.name || json?.name;
        if (name) setBuildingName(name);
      })
      .catch(() => {});
  }, [id]);

  const title = buildingName || "Building Financials";

  if (!id) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageHeader title={title} />
          <PageContent><p className="loading-text">Loading…</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title={title} />
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

export const getServerSideProps = withServerTranslations(["common","manager"]);
