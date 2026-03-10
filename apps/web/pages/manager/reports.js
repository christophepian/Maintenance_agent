import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import { styles } from "../../styles/managerStyles";

export default function ReportsPage() {
  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader title="Reports" subtitle="Analytics and reporting dashboards" />
        <PageContent>
          <Panel>
            <div style={styles.comingSoonContainer}>
              <span style={styles.comingSoonBadge}>Coming Soon</span>
              <h2 style={styles.comingSoonTitle}>Reporting Dashboards</h2>
              <p style={styles.comingSoonText}>
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
