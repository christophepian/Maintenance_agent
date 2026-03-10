import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { styles } from "../../../styles/managerStyles";

export default function PeopleOwnersPage() {
  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader title="Owners" subtitle="Property owners and co-owners" />
        <PageContent>
          <Panel>
            <div style={styles.comingSoonContainer}>
              <span style={styles.comingSoonBadge}>Coming Soon</span>
              <h2 style={styles.comingSoonTitle}>Owner Management</h2>
              <p style={styles.comingSoonText}>
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
