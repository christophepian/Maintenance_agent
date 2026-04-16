import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { fetchWithAuth, postWithAuth } from "../../../lib/api";

import { cn } from "../../../lib/utils";
const STATUS_COLORS = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-slate-100 text-slate-800",
};

const FREQUENCY_LABELS = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-Annual",
  ANNUAL: "Annual",
};

export default function ContractorBillingScheduleDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const [showStopForm, setShowStopForm] = useState(false);

  const fetchSchedule = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/contractor-billing-schedules/${id}`);
      if (res.ok) {
        const json = await res.json();
        setSchedule(json.data);
      }
    } catch (e) {
      console.error("Failed to load schedule:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const fmt = (cents) =>
    (cents / 100).toLocaleString("de-CH", { style: "currency", currency: "CHF" });

  const doAction = async (action, body) => {
    setActing(true);
    try {
      const res = await postWithAuth(
        `/api/contractor-billing-schedules/${id}/${action}`,
        body || {}
      );
      if (res.ok) {
        fetchSchedule();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `Failed to ${action}`);
      }
    } catch (e) {
      alert(`Error: ${action}`);
    } finally {
      setActing(false);
    }
  };

  const handleGenerate = async () => {
    setActing(true);
    try {
      const res = await postWithAuth(
        `/api/contractor-billing-schedules/${id}/generate`,
        {}
      );
      if (res.ok) {
        const json = await res.json();
        alert(
          `Invoice generated! Amount: ${fmt(
            json.data?.invoice?.totalCents || 0
          )}`
        );
        fetchSchedule();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to generate invoice");
      }
    } catch (e) {
      alert("Error generating invoice");
    } finally {
      setActing(false);
    }
  };

  const handleStop = async (e) => {
    e.preventDefault();
    await doAction("stop", { reason: stopReason });
    setShowStopForm(false);
    setStopReason("");
  };

  if (loading) {
    return (
      <AppShell>
        <PageShell>
          <PageContent>
            <p className="text-slate-500 py-8">Loading…</p>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  if (!schedule) {
    return (
      <AppShell>
        <PageShell>
          <PageContent>
            <p className="text-red-600 py-8">Schedule not found.</p>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageShell>
        <PageHeader
          title={schedule.description}
          subtitle={`Contractor: ${schedule.contractor?.name || "—"}`}
          backLink="/manager/contractor-billing-schedules"
          backLabel="← Back to Contractor Billing"
        />
        <PageContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Schedule Info */}
            <Panel>
              <h3 className="font-semibold text-slate-800 mb-3">Schedule Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <span
                      className={cn("px-2 py-0.5 rounded text-xs font-semibold", STATUS_COLORS[schedule.status] || "bg-slate-100")}
                    >
                      {schedule.status}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Frequency</dt>
                  <dd>{FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Anchor Day</dt>
                  <dd>{schedule.anchorDay}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Amount</dt>
                  <dd className="font-semibold">{fmt(schedule.amountCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">VAT Rate</dt>
                  <dd>{schedule.vatRate}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Amount incl. VAT</dt>
                  <dd className="font-semibold">
                    {fmt(Math.round(schedule.amountCents * (1 + schedule.vatRate / 100)))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Next Period Start</dt>
                  <dd>
                    {new Date(schedule.nextPeriodStart).toLocaleDateString("de-CH")}
                  </dd>
                </div>
                {schedule.lastGeneratedPeriod && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Last Generated</dt>
                    <dd>
                      {new Date(schedule.lastGeneratedPeriod).toLocaleDateString("de-CH")}
                    </dd>
                  </div>
                )}
                {schedule.building && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Building</dt>
                    <dd>{schedule.building.name}</dd>
                  </div>
                )}
                {schedule.completedAt && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Completed At</dt>
                      <dd>
                        {new Date(schedule.completedAt).toLocaleDateString("de-CH")}
                      </dd>
                    </div>
                    {schedule.completionReason && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Reason</dt>
                        <dd>{schedule.completionReason}</dd>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">Created</dt>
                  <dd>{new Date(schedule.createdAt).toLocaleDateString("de-CH")}</dd>
                </div>
              </dl>
            </Panel>

            {/* Contractor Info */}
            <Panel>
              <h3 className="font-semibold text-slate-800 mb-3">Contractor</h3>
              {schedule.contractor ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Name</dt>
                    <dd>{schedule.contractor.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Email</dt>
                    <dd>{schedule.contractor.email}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Phone</dt>
                    <dd>{schedule.contractor.phone}</dd>
                  </div>
                  {schedule.contractor.iban && (
                    <div className="flex justify-between">
                      <dt className="text-slate-500">IBAN</dt>
                      <dd className="font-mono text-xs">{schedule.contractor.iban}</dd>
                    </div>
                  )}
                  {schedule.contractor.vatNumber && (
                    <div className="flex justify-between">
                      <dt className="text-slate-500">VAT Number</dt>
                      <dd>{schedule.contractor.vatNumber}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Active</dt>
                    <dd>
                      <span
                        className={cn("px-2 py-0.5 rounded text-xs font-semibold", schedule.contractor.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700")}
                      >
                        {schedule.contractor.isActive ? "Yes" : "No"}
                      </span>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-slate-500 text-sm">Contractor data unavailable</p>
              )}
            </Panel>
          </div>

          {/* Actions */}
          {schedule.status !== "COMPLETED" && (
            <Panel className="mt-6">
              <h3 className="font-semibold text-slate-800 mb-3">Actions</h3>
              <div className="flex flex-wrap gap-3">
                {schedule.status === "ACTIVE" && (
                  <>
                    <button
                      onClick={handleGenerate}
                      disabled={acting}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
                    >
                      Generate Invoice Now
                    </button>
                    <button
                      onClick={() => doAction("pause")}
                      disabled={acting}
                      className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm disabled:opacity-50"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => setShowStopForm(true)}
                      disabled={acting}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-50"
                    >
                      Stop
                    </button>
                  </>
                )}
                {schedule.status === "PAUSED" && (
                  <>
                    <button
                      onClick={() => doAction("resume")}
                      disabled={acting}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => setShowStopForm(true)}
                      disabled={acting}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-50"
                    >
                      Stop
                    </button>
                  </>
                )}
              </div>

              {showStopForm && (
                <form onSubmit={handleStop} className="mt-4 flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Reason (optional)
                    </label>
                    <input
                      type="text"
                      value={stopReason}
                      onChange={(e) => setStopReason(e.target.value)}
                      placeholder="e.g. Contract ended"
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={acting}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-50"
                  >
                    Confirm Stop
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStopForm(false)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-sm"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </Panel>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
