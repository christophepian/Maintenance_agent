import AppShell from "../../components/AppShell";

export default function TenantAssetsPage() {
  return (
    <AppShell role="TENANT">
      <div className="main-container">
        <h1>My Unit &amp; Assets</h1>
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <span className="inline-block px-3 py-1 rounded-xl bg-sky-50 text-sky-700 text-xs font-semibold tracking-wide uppercase mb-3">Coming Soon</span>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Unit &amp; Asset Details</h2>
          <p className="text-sm text-slate-500 max-w-md">
            Your unit information, appliance inventory, and maintenance history
            will appear here.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
