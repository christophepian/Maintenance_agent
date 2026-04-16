import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import { authHeaders } from "../../../lib/api";
import Badge from "../../../components/ui/Badge";
import { rfpVariant, quoteVariant, inviteVariant } from "../../../lib/statusVariants";

import { cn } from "../../../lib/utils";
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH");
}

function formatCHF(cents) {
  if (cents == null) return "—";
  return `CHF ${(cents / 100).toFixed(2)}`;
}

export default function RfpDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [rfp, setRfp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [awardError, setAwardError] = useState("");

  // ── Fallback actions state ──────────────────────────────────
  const [contractors, setContractors] = useState([]);
  const [selectedReinviteIds, setSelectedReinviteIds] = useState([]);
  const [reinviting, setReinviting] = useState(false);
  const [reinviteMsg, setReinviteMsg] = useState("");
  const [directAssignId, setDirectAssignId] = useState("");
  const [directAssigning, setDirectAssigning] = useState(false);
  const [directAssignMsg, setDirectAssignMsg] = useState("");

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rfps/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load RFP");
      setRfp(data?.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch contractors for fallback actions (re-invite / direct-assign pickers)
  useEffect(() => {
    async function fetchContractors() {
      try {
        const res = await fetch("/api/contractors", { headers: authHeaders() });
        const data = await res.json();
        if (res.ok) {
          setContractors(data?.data || data || []);
        }
      } catch {
        // non-fatal — buttons just won't work
      }
    }
    fetchContractors();
  }, []);

  // ── Reinvite handler ──────────────────────────────────────
  const handleReinvite = useCallback(async () => {
    if (selectedReinviteIds.length === 0) return;
    setReinviting(true);
    setReinviteMsg("");
    try {
      const res = await fetch(`/api/rfps/${id}/reinvite`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ contractorIds: selectedReinviteIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error?.code || "Reinvite failed");
      const d = data.data;
      setReinviteMsg(`✅ ${d.addedCount} contractor(s) invited, ${d.skippedCount} already invited. Total invites: ${d.totalInvites}`);
      setSelectedReinviteIds([]);
      await loadData();
    } catch (e) {
      setReinviteMsg(`❌ ${e?.message || e}`);
    } finally {
      setReinviting(false);
    }
  }, [id, selectedReinviteIds, loadData]);

  // ── Direct-assign handler ─────────────────────────────────
  const handleDirectAssign = useCallback(async () => {
    if (!directAssignId) return;
    const contractorName = contractors.find((c) => c.id === directAssignId)?.name || directAssignId.slice(0, 8);
    if (!confirm(`Bypass quotes and directly assign this RFP to ${contractorName}?\n\nThis will close the RFP, reject all submitted quotes, and assign the contractor.`)) return;
    setDirectAssigning(true);
    setDirectAssignMsg("");
    try {
      const res = await fetch(`/api/rfps/${id}/direct-assign`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ contractorId: directAssignId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error?.code || "Direct assign failed");
      setDirectAssignMsg(`✅ Contractor assigned. Job created: ${data.data.jobCreated ? "Yes" : "No"}`);
      setDirectAssignId("");
      await loadData();
    } catch (e) {
      setDirectAssignMsg(`❌ ${e?.message || e}`);
    } finally {
      setDirectAssigning(false);
    }
  }, [id, directAssignId, contractors, loadData]);

  const handleAward = useCallback(
    async (quoteId, contractorName) => {
      if (!confirm(`Award this RFP to ${contractorName || "this contractor"}?`)) return;
      setAwarding(true);
      setAwardError("");
      try {
        const res = await fetch(`/api/rfps/${id}/award`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg =
            data?.error?.message ||
            data?.error?.code ||
            "Failed to award quote";
          throw new Error(msg);
        }
        // Refresh the RFP data to show new statuses
        await loadData();
      } catch (e) {
        setAwardError(String(e?.message || e));
      } finally {
        setAwarding(false);
      }
    },
    [id, loadData],
  );

  const title = rfp
    ? `RFP #${rfp.id?.slice(0, 8)}`
    : "RFP Detail";

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={title}
          subtitle={rfp ? `Category: ${rfp.category || "—"}` : "Loading…"}
          actions={
            <Link
              href="/manager/rfps"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Back to RFPs
            </Link>
          }
        />
        <PageContent>
          <ErrorBanner error={error} className="text-sm" />

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : rfp ? (
            <>
              {/* RFP Metadata */}
              <Panel title="RFP Details">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Status</dt>
                    <dd className="mt-1">
                      <Badge variant={rfpVariant(rfp.status)}>{rfp.status}</Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Category</dt>
                    <dd className="mt-1 text-sm text-slate-900">{rfp.category || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Legal Obligation</dt>
                    <dd className="mt-1 text-sm text-slate-900">{rfp.legalObligation || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Building</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {rfp.building?.name || "—"}
                      {rfp.building?.address && (
                        <span className="text-slate-500"> · {rfp.building.address}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Unit</dt>
                    <dd className="mt-1 text-sm text-slate-900">{rfp.unit?.unitNumber || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Target Invites</dt>
                    <dd className="mt-1 text-sm text-slate-900">{rfp.inviteCount ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Quote Deadline</dt>
                    <dd className="mt-1 text-sm text-slate-900">{formatDate(rfp.deadlineAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Created</dt>
                    <dd className="mt-1 text-sm text-slate-900">{formatDate(rfp.createdAt)}</dd>
                  </div>
                  {rfp.awardedContractor && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Awarded To</dt>
                      <dd className="mt-1 text-sm text-green-700 font-medium">
                        {rfp.awardedContractor.name}
                      </dd>
                    </div>
                  )}
                </dl>
              </Panel>

              {/* Linked Request */}
              {rfp.request && (
                <Panel title="Linked Maintenance Request">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Request #</dt>
                      <dd className="mt-1 text-sm">
                        <Link
                          href={`/manager/requests?highlight=${rfp.request.id}`}
                          className="text-indigo-600 hover:underline font-medium"
                        >
                          #{rfp.request.requestNumber}
                        </Link>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Request Status</dt>
                      <dd className="mt-1 text-sm text-slate-900">{rfp.request.status}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Request Category</dt>
                      <dd className="mt-1 text-sm text-slate-900">{rfp.request.category || "—"}</dd>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <dt className="text-sm font-medium text-slate-500">Description</dt>
                      <dd className="mt-1 text-sm text-slate-900 whitespace-pre-line">
                        {rfp.request.description || "—"}
                      </dd>
                    </div>
                    {rfp.request.attachmentCount > 0 && (
                      <div>
                        <dt className="text-sm font-medium text-slate-500">Attachments</dt>
                        <dd className="mt-1 text-sm text-slate-900">
                          {rfp.request.attachmentCount} file{rfp.request.attachmentCount !== 1 ? "s" : ""}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Request Created</dt>
                      <dd className="mt-1 text-sm text-slate-900">{formatDate(rfp.request.createdAt)}</dd>
                    </div>
                  </dl>
                </Panel>
              )}

              {/* Invited Contractors */}
              <Panel
                title={`Invited Contractors (${rfp.invites?.length || 0})`}
                bodyClassName="p-0"
              >
                {rfp.invites?.length > 0 ? (
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>Contractor</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Invite Status</th>
                        <th>Invited</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfp.invites.map((inv) => (
                        <tr key={inv.id}>
                          <td>
                            {inv.contractor ? (
                              <Link
                                href={`/manager/people/vendors/${inv.contractorId}`}
                                className="text-indigo-600 hover:underline"
                              >
                                {inv.contractor.name}
                              </Link>
                            ) : (
                              inv.contractorId?.slice(0, 8)
                            )}
                          </td>
                          <td className="text-slate-500">{inv.contractor?.email || "—"}</td>
                          <td className="text-slate-500">{inv.contractor?.phone || "—"}</td>
                          <td>
                            <Badge variant={inviteVariant(inv.status)}>{inv.status}</Badge>
                          </td>
                          <td>{formatDate(inv.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    No contractors invited yet.
                  </p>
                )}
              </Panel>

              {/* Quotes */}
              <Panel
                title={`Quotes (${rfp.quotes?.length || 0})`}
                bodyClassName="p-0"
              >
                <ErrorBanner error={awardError} className="mx-4 mt-4 text-sm" />
                {rfp.status === "PENDING_OWNER_APPROVAL" && (
                  <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    ⏳ This RFP requires owner approval. The owner must review and confirm the award.
                  </div>
                )}
                {rfp.quotes?.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {rfp.quotes.map((q) => (
                      <div
                        key={q.id}
                        className={cn("p-4", q.status === "AWARDED" ? "bg-green-50/40" :
                          q.status === "REJECTED" ? "bg-slate-50/60 opacity-75" : "")}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {q.contractor ? (
                              <Link
                                href={`/manager/people/vendors/${q.contractorId}`}
                                className="text-sm font-semibold text-indigo-600 hover:underline"
                              >
                                {q.contractor.name}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium text-slate-700">{q.contractorId?.slice(0, 8)}</span>
                            )}
                            <Badge variant={quoteVariant(q.status || "SUBMITTED")}>{q.status || "SUBMITTED"}</Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-base font-semibold text-slate-900 font-mono">
                              {formatCHF(q.amountCents)}
                              {q.vatIncluded === false && (
                                <span className="text-xs text-slate-400 ml-1">excl. VAT</span>
                              )}
                            </span>
                            {(rfp.status === "OPEN" || rfp.status === "PENDING_OWNER_APPROVAL") &&
                              q.status === "SUBMITTED" && (
                              <button
                                onClick={() => handleAward(q.id, q.contractor?.name)}
                                disabled={awarding}
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {awarding ? "Awarding…" : "🏆 Award"}
                              </button>
                            )}
                          </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 text-sm mb-2">
                          {q.estimatedDurationDays && (
                            <div>
                              <dt className="text-xs text-slate-500">Duration</dt>
                              <dd className="text-slate-900">{q.estimatedDurationDays} day{q.estimatedDurationDays !== 1 ? "s" : ""}</dd>
                            </div>
                          )}
                          {q.earliestAvailability && (
                            <div>
                              <dt className="text-xs text-slate-500">Available</dt>
                              <dd className="text-slate-900">{formatDate(q.earliestAvailability)}</dd>
                            </div>
                          )}
                          {q.validUntil && (
                            <div>
                              <dt className="text-xs text-slate-500">Valid Until</dt>
                              <dd className="text-slate-900">{formatDate(q.validUntil)}</dd>
                            </div>
                          )}
                          <div>
                            <dt className="text-xs text-slate-500">Submitted</dt>
                            <dd className="text-slate-900">{formatDate(q.submittedAt)}</dd>
                          </div>
                        </dl>
                        {q.workPlan && (
                          <div className="mt-2">
                            <dt className="text-xs font-medium text-slate-500">Work Plan</dt>
                            <dd className="mt-0.5 text-sm text-slate-700 whitespace-pre-line">{q.workPlan}</dd>
                          </div>
                        )}
                        {q.assumptions && (
                          <div className="mt-2">
                            <dt className="text-xs font-medium text-slate-500">Assumptions</dt>
                            <dd className="mt-0.5 text-sm text-slate-500 whitespace-pre-line">{q.assumptions}</dd>
                          </div>
                        )}
                        {q.notes && (
                          <div className="mt-2">
                            <dt className="text-xs font-medium text-slate-500">Notes</dt>
                            <dd className="mt-0.5 text-sm text-slate-500">{q.notes}</dd>
                          </div>
                        )}
                        {q.lineItems && q.lineItems.length > 0 && (
                          <div className="mt-2">
                            <dt className="text-xs font-medium text-slate-500 mb-1">Line Items</dt>
                            <dd>
                              <table className="w-full text-sm">
                                <tbody>
                                  {q.lineItems.map((li, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 last:border-0">
                                      <td className="py-1 text-slate-700">{li.description}</td>
                                      <td className="py-1 text-right font-mono text-slate-700">{formatCHF(li.amountCents)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </dd>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    No quotes submitted yet.
                  </p>
                )}
              </Panel>

              {/* Fallback Actions — only for OPEN RFPs */}
              {rfp.status === "OPEN" && (
                <Panel title="Fallback Actions">
                  <p className="text-sm text-slate-500 mb-4">
                    If submitted quotes are insufficient, you can re-invite more contractors or bypass
                    quote collection entirely and directly assign a contractor.
                  </p>

                  {/* ── Re-invite contractors ──────────────────────── */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Re-invite Contractors</h4>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-slate-500 mb-1">Select contractors to invite</label>
                        <select
                          multiple
                          value={selectedReinviteIds}
                          onChange={(e) =>
                            setSelectedReinviteIds(
                              Array.from(e.target.selectedOptions, (o) => o.value),
                            )
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
                          className="min-h-[80px]"
                        >
                          {contractors
                            .filter(
                              (c) =>
                                !rfp.invites?.some(
                                  (inv) => inv.contractorId === c.id,
                                ),
                            )
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.email ? `(${c.email})` : ""}
                              </option>
                            ))}
                        </select>
                      </div>
                      <button
                        onClick={handleReinvite}
                        disabled={reinviting || selectedReinviteIds.length === 0}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reinviting ? "Inviting…" : "📨 Re-invite"}
                      </button>
                    </div>
                    {reinviteMsg && (
                      <p className={cn("mt-2 text-sm", reinviteMsg.startsWith("✅") ? "text-green-700" : "text-red-700")}>
                        {reinviteMsg}
                      </p>
                    )}
                  </div>

                  <hr className="border-slate-100 mb-4" />

                  {/* ── Direct-assign contractor ──────────────────── */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Direct Assign Contractor</h4>
                    <p className="text-xs text-slate-400 mb-2">
                      This will close the RFP, reject all submitted quotes, and assign the selected
                      contractor to the linked maintenance request.
                    </p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-slate-500 mb-1">Select contractor</label>
                        <select
                          value={directAssignId}
                          onChange={(e) => setDirectAssignId(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
                        >
                          <option value="">— choose contractor —</option>
                          {contractors.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.email ? `(${c.email})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handleDirectAssign}
                        disabled={directAssigning || !directAssignId}
                        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {directAssigning ? "Assigning…" : "⚡ Direct Assign"}
                      </button>
                    </div>
                    {directAssignMsg && (
                      <p className={cn("mt-2 text-sm", directAssignMsg.startsWith("✅") ? "text-green-700" : "text-red-700")}>
                        {directAssignMsg}
                      </p>
                    )}
                  </div>
                </Panel>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">RFP not found.</p>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
