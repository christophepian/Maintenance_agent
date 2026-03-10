import AppShell from "../../components/AppShell";

const comingSoon = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '64px 24px', textAlign: 'center',
  },
  badge: {
    display: 'inline-block', padding: '4px 12px', borderRadius: '12px',
    backgroundColor: '#f0f9ff', color: '#0369a1', fontSize: '12px',
    fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
    marginBottom: '12px',
  },
  title: { fontSize: '20px', fontWeight: 600, color: '#1e293b', margin: '0 0 8px 0' },
  text: { fontSize: '14px', color: '#64748b', margin: 0, maxWidth: '400px' },
};

export default function TenantAssetsPage() {
  return (
    <AppShell role="TENANT">
      <div className="main-container">
        <h1>My Unit &amp; Assets</h1>
        <div style={comingSoon.container}>
          <span style={comingSoon.badge}>Coming Soon</span>
          <h2 style={comingSoon.title}>Unit &amp; Asset Details</h2>
          <p style={comingSoon.text}>
            Your unit information, appliance inventory, and maintenance history
            will appear here.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
