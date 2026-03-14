import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
export default function ReportsPage() {
  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader title="Reports" subtitle="Analytics and reporting dashboards" />
        <PageContent>
          <Panel>
            <div className="coming-soon">
              <span className="coming-soon-badge">Coming Soon</span>
              <h2 className="coming-soon-title">Reporting Dashboards</h2>
              <p className="coming-soon-text">
                Financial summaries, maintenance trends, and portfolio analytics
                will appear here.
              </p>
            </div>
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
