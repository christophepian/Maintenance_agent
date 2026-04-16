import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import { formatDate } from "../../../lib/format";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Section from "../../../components/layout/Section";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import Badge from "../../../components/ui/Badge";
import { authHeaders } from "../../../lib/api";
export default function ApplicationDetailPage() {
  const router = useRouter();
  const { applicationId } = router.query;

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady || !applicationId) return;
    loadApplication();
  }, [router.isReady, applicationId]);

  async function loadApplication() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/manager/rental-applications/${applicationId}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load application");
      setApp(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageContent><p className="text-sm text-slate-500">Loading…</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  if (!app) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageContent>
            <ErrorBanner error={error} className="text-sm" />
            <p className="text-sm text-slate-500">Application not found.</p>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Application Detail"
          subtitle={`ID: ${app.id?.slice(0, 8)}… — Status: ${app.status}`}
          actions={
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Back
            </button>
          }
        />

        <PageContent>
          <ErrorBanner error={error} className="text-sm" />

          {/* Applicants */}
          <Panel title="Applicants">
            <div className="space-y-4">
              {(app.applicants || []).map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {a.firstName} {a.lastName}
                    </h4>
                    <Badge variant={a.role === "PRIMARY" ? "brand" : "muted"} size="sm">
                      {a.role === "PRIMARY" ? "Primary" : "Co-applicant"}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
                    <Detail label="Email" value={a.email} />
                    <Detail label="Phone" value={a.phone} />
                    <Detail label="Date of birth" value={a.dateOfBirth} />
                    <Detail label="Nationality" value={a.nationality} />
                    <Detail label="Civil status" value={a.civilStatus?.replace(/_/g, " ")} />
                    <Detail label="Employer" value={a.employer} />
                    <Detail label="Job title" value={a.jobTitle} />
                    <Detail label="Work location" value={a.workLocation} />
                    <Detail label="Employed since" value={a.employedSince} />
                    <Detail label="Net monthly income" value={a.netMonthlyIncome ? `CHF ${a.netMonthlyIncome}` : "—"} />
                    <Detail label="Permit type" value={a.permitType} />
                    <Detail label="Debt enforcement" value={a.hasDebtEnforcement ? "Yes ⚠️" : "No"} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Household Info */}
          <Panel title="Household & Current Housing">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
              <Detail label="Current landlord" value={app.currentLandlordName} />
              <Detail label="Landlord address" value={app.currentLandlordAddress} />
              <Detail label="Landlord phone" value={app.currentLandlordPhone} />
              <Detail label="Reason for leaving" value={app.reasonForLeaving} />
              <Detail label="Desired move-in" value={app.desiredMoveInDate} />
              <Detail label="Household size" value={app.householdSize} />
              <Detail label="Pets" value={app.hasPets ? (app.petsDescription || "Yes") : "No"} />
              <Detail label="RC insurance" value={app.hasRcInsurance ? (app.rcInsuranceCompany || "Yes") : "No"} />
              <Detail label="Vehicle" value={app.hasVehicle ? (app.vehicleDescription || "Yes") : "No"} />
              <Detail label="Needs parking" value={app.needsParking ? "Yes" : "No"} />
              {app.remarks && <div className="col-span-full mt-2"><Detail label="Remarks" value={app.remarks} /></div>}
            </div>
          </Panel>

          {/* Unit Evaluations */}
          {app.applicationUnits?.length > 0 && (
            <Panel title="Unit Evaluations">
              <div className="space-y-3">
                {app.applicationUnits.map((au) => (
                  <div key={au.id} className="rounded-lg border border-slate-100 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-slate-900">
                          {au.unit?.building?.id ? (
                            <Link href={`/manager/buildings/${au.unit.building.id}/financials`} className="text-indigo-600 hover:underline">
                              {au.unit.building.name || "—"}
                            </Link>
                          ) : (au.unit?.building?.name || "—")}
                          {" "}— Unit{" "}
                          {au.unit?.id ? (
                            <Link href={`/admin-inventory/units/${au.unit.id}`} className="text-indigo-600 hover:underline">
                              {au.unit.unitNumber || "—"}
                            </Link>
                          ) : (au.unit?.unitNumber || "—")}
                        </span>
                        <Badge variant={au.disqualified ? "destructive" : "success"} size="sm" className="ml-2">
                          {au.disqualified ? "Disqualified" : "Qualified"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-900">{au.scoreTotal ?? "—"}</div>
                        <div className="text-xs text-slate-500">score</div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                      <Detail label="Confidence" value={`${au.confidenceScore ?? 0}%`} />
                      <Detail label="Status" value={(au.status || "").replace(/_/g, " ")} />
                      <Detail label="Manager delta" value={au.managerScoreDelta || 0} />
                    </div>
                    {au.disqualifiedReasons?.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-red-700">Reasons: </span>
                        <span className="text-xs text-red-600">{au.disqualifiedReasons.join(", ")}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Signature */}
          {app.signedName && (
            <Panel title="Signature">
              <div className="text-sm text-slate-700">
                <span className="font-serif italic text-lg">{app.signedName}</span>
                {app.signedAt && <span className="ml-4 text-xs text-slate-500">Signed {formatDate(app.signedAt)}</span>}
              </div>
            </Panel>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <span className="font-medium text-slate-500">{label}:</span>{" "}
      <span className="text-slate-700">{value || "—"}</span>
    </div>
  );
}
