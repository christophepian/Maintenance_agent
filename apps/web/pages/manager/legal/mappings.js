import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import CategoryMappings from "../../../components/CategoryMappings";
import Link from "next/link";

export default function LegalMappingsPage() {
  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Category Mappings"
          subtitle="How the legal engine connects tenant issues to Swiss law"
          actions={
            <Link
              href="/manager/legal"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              &larr; Legal Engine
            </Link>
          }
        />
        <PageContent>
          <CategoryMappings />
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
