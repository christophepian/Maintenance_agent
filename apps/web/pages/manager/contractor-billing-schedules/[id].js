import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { fetchWithAuth, postWithAuth } from "../../../lib/api";
import { useDetailResource } from "../../../lib/hooks/useDetailResource";
import { useAction } from "../../../lib/hooks/useAction";
import { formatChfCents, formatDate } from "../../../lib/format";

import { cn } from "../../../lib/utils";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { DetailList, DetailRow } from "../../../components/ui/DetailList";
import ActionBar from "../../../components/ui/ActionBar";
import ResourceShell from "../../../components/ui/ResourceShell";
import { billingScheduleVariant } from "../../../lib/statusVariants";

const FREQUENCY_LABELS = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-Annual",
  ANNUAL: "Annual",
};

export default function ContractorBillingScheduleDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: schedule, setData: setSchedule, loading, error, refresh } = useDetailResource(
    id ? `/api/contractor-billing-schedules/${id}` : null
  );
  const { pending: acting, run: runAction } = useAction();
  const [stopReason, setStopReason] = useState("");
  const [showStopForm, setShowStopForm] = useState(false);

  const doAction = (action, body) => {
    runAction(async () => {
      const res = await postWithAuth(
        `/api/contractor-billing-schedules/${id}/${action}`,
        body || {}
      );
      if (res.ok) {
        refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `Failed to ${action}`);
      }
    }).catch(e => alert(`Error: ${action}`));
  };

  const handleGenerate = () => {
    runAction(async () => {
      const res = await postWithAuth(
        `/api/contractor-billing-schedules/${id}/generate`,
        {}
      );
      if (res.ok) {
        const json = await res.json();
        alert(
          `Invoice generated! Amount: ${formatChfCents(
            json.data?.invoice?.totalCents || 0
          )}`
        );
        refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to generate invoice");
      }
    }).catch(e => alert("Error generating invoice"));
  };

  const handleStop = async (e) => {
    e.preventDefault();
    await doAction("stop", { reason: stopReason });
    setShowStopForm(false);
    setStopReason("");
  };

  return (
    <AppShell>
      <PageShell>
        <ResourceShell loading={loading} error={error} hasData={!!schedule} emptyMessage="Schedule not found.">
        {schedule && (<>
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
              <DetailList>
                <DetailRow label="Status">
                    <Badge variant={billingScheduleVariant(schedule.status)} size="sm">{schedule.status}</Badge>
                </DetailRow>
                <DetailRow label="Frequency">{FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}</DetailRow>
                <DetailRow label="Anchor Day">{schedule.anchorDay}</DetailRow>
                <DetailRow label="Amount">
                  <span className="font-semibold">{formatChfCents(schedule.amountCents)}</span>
                </DetailRow>
                <DetailRow label="VAT Rate">{schedule.vatRate}%</DetailRow>
                <DetailRow label="Amount incl. VAT">
                  <span className="font-semibold">
                    {formatChfCents(Math.round(schedule.amountCents * (1 + schedule.vatRate / 100)))}
                  </span>
                </DetailRow>
                <DetailRow label="Next Period Start">
                  {formatDate(schedule.nextPeriodStart)}
                </DetailRow>
                {schedule.lastGeneratedPeriod && (
                  <DetailRow label="Last Generated">
                    {formatDate(schedule.lastGeneratedPeriod)}
                  </DetailRow>
                )}
                {schedule.building && (
                  <DetailRow label="Building">{schedule.building.name}</DetailRow>
                )}
                {schedule.completedAt && (
                  <>
                    <DetailRow label="Completed At">
                      {formatDate(schedule.completedAt)}
                    </DetailRow>
                    {schedule.completionReason && (
                      <DetailRow label="Reason">{schedule.completionReason}</DetailRow>
                    )}
                  </>
                )}
                <DetailRow label="Created">{formatDate(schedule.createdAt)}</DetailRow>
              </DetailList>
            </Panel>

            {/* Contractor Info */}
            <Panel>
              <h3 className="font-semibold text-slate-800 mb-3">Contractor</h3>
              {schedule.contractor ? (
                <DetailList>
                  <DetailRow label="Name">{schedule.contractor.name}</DetailRow>
                  <DetailRow label="Email">{schedule.contractor.email}</DetailRow>
                  <DetailRow label="Phone">{schedule.contractor.phone}</DetailRow>
                  {schedule.contractor.iban && (
                    <DetailRow label="IBAN">
                      <span className="font-mono text-xs">{schedule.contractor.iban}</span>
                    </DetailRow>
                  )}
                  {schedule.contractor.vatNumber && (
                    <DetailRow label="VAT Number">{schedule.contractor.vatNumber}</DetailRow>
                  )}
                  <DetailRow label="Active">
                    <Badge variant={schedule.contractor.isActive ? "success" : "destructive"} size="sm">
                      {schedule.contractor.isActive ? "Yes" : "No"}
                    </Badge>
                  </DetailRow>
                </DetailList>
              ) : (
                <p className="text-slate-500 text-sm">Contractor data unavailable</p>
              )}
            </Panel>
          </div>

          {/* Actions */}
          {schedule.status !== "COMPLETED" && (
            <Panel className="mt-6">
              <h3 className="font-semibold text-slate-800 mb-3">Actions</h3>
              <ActionBar className="mt-0">
                {schedule.status === "ACTIVE" && (
                  <>
                    <Button
                      variant="success" size="sm"
                      onClick={handleGenerate}
                      disabled={acting}
                    >
                      Generate Invoice Now
                    </Button>
                    <Button
                      variant="warning" size="sm"
                      onClick={() => doAction("pause")}
                      disabled={acting}
                    >
                      Pause
                    </Button>
                    <Button
                      variant="destructive" size="sm"
                      onClick={() => setShowStopForm(true)}
                      disabled={acting}
                    >
                      Stop
                    </Button>
                  </>
                )}
                {schedule.status === "PAUSED" && (
                  <>
                    <Button
                      variant="success" size="sm"
                      onClick={() => doAction("resume")}
                      disabled={acting}
                    >
                      Resume
                    </Button>
                    <Button
                      variant="destructive" size="sm"
                      onClick={() => setShowStopForm(true)}
                      disabled={acting}
                    >
                      Stop
                    </Button>
                  </>
                )}
              </ActionBar>
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
                  <Button
                    variant="destructive" size="sm"
                    type="submit"
                    disabled={acting}
                  >
                    Confirm Stop
                  </Button>
                  <Button
                    variant="secondary" size="sm"
                    type="button"
                    onClick={() => setShowStopForm(false)}
                  >
                    Cancel
                  </Button>
                </form>
              )}
            </Panel>
          )}
        </PageContent>
        </>)}
        </ResourceShell>
      </PageShell>
    </AppShell>
  );
}
