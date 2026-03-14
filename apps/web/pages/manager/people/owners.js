import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
export default function PeopleOwnersPage() {
  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader title="Owners" subtitle="Property owners and co-owners" />
        <PageContent>
          <Panel>
            <div className="coming-soon">
              <span className="coming-soon-badge">Coming Soon</span>
              <h2 className="coming-soon-title">Owner Management</h2>
              <p className="coming-soon-text">
                Owner profiles, ownership stakes, and communication preferences
                will appear here.
              </p>
            </div>
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
