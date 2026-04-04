import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { fetchWithAuth } from "../../../lib/api";

const STATUS_COLORS = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  APPLIED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const TYPE_LABELS = {
  CPI_INDEXATION: "CPI Indexation",
  REFERENCE_RATE_CHANGE: "Ref. Rate Change",
  MANUAL: "Manual",
};

export default function RentAdjustmentsList() {
  const router = useRouter();
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const tabs = ["All", "Draft", "Approved", "Applied", "Rejected"];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== "All") params.set("status", tab.toUpperCase());
      const res = await fetchWithAuth(`/api/rent-adjustments?${params}`);
      if (res.ok) {
        const json = await res.json();
        setAdjustments(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load rent adjustments:", e);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (cents) => (cents / 100).toLocaleString("de-CH", { style: "currency", currency: "CHF" });

  return (
    <AppShell>
      <PageShell>
        <PageHeader
          title="Rent Adjustments"
          subtitle="CPI-indexed and manual rent adjustments"
        />
        <PageContent>
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  tab === t
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Panel>
            {loading ? (
              <p className="text-gray-500 py-4">Loading…</p>
            ) : adjustments.length === 0 ? (
              <p className="text-gray-500 py-4">
                No rent adjustments found.{" "}
                <span className="text-sm">
                  Use the lease detail page to create adjustments.
                </span>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Tenant</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Effective</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Old Rent</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">New Rent</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Change</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adjustments.map((adj) => {
                      const changePct = adj.previousRentCents
                        ? ((adj.adjustmentCents / adj.previousRentCents) * 100).toFixed(1)
                        : "—";
                      return (
                        <tr key={adj.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <a
                              href={`/manager/rent-adjustments/${adj.id}`}
                              className="text-indigo-600 hover:underline"
                            >
                              {adj.lease?.tenantName || "—"}
                            </a>
                          </td>
                          <td className="px-3 py-2">{TYPE_LABELS[adj.adjustmentType] || adj.adjustmentType}</td>
                          <td className="px-3 py-2">{new Date(adj.effectiveDate).toLocaleDateString("de-CH")}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[adj.status] || "bg-gray-100"}`}>
                              {adj.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{fmt(adj.previousRentCents)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{fmt(adj.newRentCents)}</td>
                          <td className={`px-3 py-2 text-right ${adj.adjustmentCents > 0 ? "text-red-600" : adj.adjustmentCents < 0 ? "text-green-600" : ""}`}>
                            {adj.adjustmentCents > 0 ? "+" : ""}{fmt(adj.adjustmentCents)} ({changePct}%)
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => router.push(`/manager/rent-adjustments/${adj.id}`)}
                              className="text-indigo-600 hover:underline text-sm"
                            >
                              {adj.status === "DRAFT" ? "Edit" : "View"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
