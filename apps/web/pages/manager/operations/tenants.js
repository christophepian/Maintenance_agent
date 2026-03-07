import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

export default function ManagerTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [tenantSearch, setTenantSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [menuOpenId, setMenuOpenId] = useState(null);

  async function loadTenants() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tenants", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to load tenants");
      }
      const rawTenants = data?.data || [];
      const uniqueMap = new Map();
      rawTenants.forEach((t) => {
        const key = [
          (t.name || "").trim().toLowerCase(),
          (t.phone || "").trim().toLowerCase(),
          (t.email || "").trim().toLowerCase(),
          t.unitId || t.unit?.id || "",
        ].join("|");
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, t);
        }
      });
      setTenants(Array.from(uniqueMap.values()));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    if (!menuOpenId) return;

    function handleClickOutside(event) {
      if (event.target.closest("[data-tenant-menu]")) return;
      setMenuOpenId(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  const filteredTenants = tenants.filter((t) => {
    const query = tenantSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      (t.name || "").toLowerCase().includes(query) ||
      (t.phone || "").toLowerCase().includes(query) ||
      (t.email || "").toLowerCase().includes(query) ||
      (t.unit?.unitNumber || "").toLowerCase().includes(query) ||
      (t.unitId || "").toLowerCase().includes(query) ||
      (t.id || "").toLowerCase().includes(query)
    );
  });

  const sortedTenants = [...filteredTenants].sort((a, b) => {
    const getValue = (t) => {
      switch (sortKey) {
        case "phone":
          return t.phone || "";
        case "email":
          return t.email || "";
        case "unit":
          return t.unit?.unitNumber || t.unitId || "";
        case "name":
        default:
          return t.name || "";
      }
    };

    const aVal = getValue(a);
    const bVal = getValue(b);

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }

    return sortDir === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  async function handleCreateTenant(e) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const payload = {
        phone: formData.phone.trim(),
        ...(formData.name.trim() ? { name: formData.name.trim() } : {}),
        ...(formData.email.trim() ? { email: formData.email.trim() } : {}),
      };
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to create tenant");
      }
      setMessage("Tenant created successfully.");
      setFormData({ name: "", phone: "", email: "" });
      setFormVisible(false);
      await loadTenants();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  async function handleDeleteTenant(tenantId) {
    if (!tenantId) return;
    if (!confirm("Delete this tenant?")) return;
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to delete tenant");
      }
      setTenants((prev) => prev.filter((t) => t.id !== tenantId));
      setMessage("Tenant deleted successfully.");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setMenuOpenId(null);
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader
          title="Tenants"
          subtitle="Tenant list and contact details."
          actions={(
            <button
              onClick={() => setFormVisible(!formVisible)}
              className="button-primary"
            >
              {formVisible ? "Cancel" : "Add Tenant"}
            </button>
          )}
        />
        <PageContent>
          {message && (
            <Panel>
              <div className="text-sm text-slate-700">{message}</div>
            </Panel>
          )}

          {error && (
            <Panel>
              <div className="text-sm text-red-600">{error}</div>
            </Panel>
          )}

          {formVisible && (
            <Panel title="Add tenant">
              <form onSubmit={handleCreateTenant} className="grid gap-4">
                <label className="label">
                  Name
                  <input
                    className="input"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Tenant name"
                  />
                </label>
                <label className="label">
                  Phone
                  <input
                    className="input"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+41 XX XXX XXXX"
                    required
                  />
                </label>
                <label className="label">
                  Email
                  <input
                    className="input"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="tenant@example.com"
                  />
                </label>
                <div className="flex justify-end">
                  <button type="submit" className="button-primary">
                    Save Tenant
                  </button>
                </div>
              </form>
            </Panel>
          )}

          <Panel title="All tenants">
            {loading ? (
              <p className="text-sm text-slate-600">Loading tenants...</p>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-slate-600">No tenants yet. Add one to get started.</p>
            ) : (
              <>
                <div className="flex justify-end mb-4">
                  <div className="max-w-sm w-full">
                    <input
                      className="input"
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      placeholder="Search…"
                    />
                  </div>
                </div>
                {filteredTenants.length === 0 ? (
                  <p className="text-sm text-slate-600">No tenants match that search.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-slate-50/70">
                        <tr>
                          <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-xs font-semibold text-slate-600"
                              onClick={() => toggleSort("name")}
                            >
                              Name
                              <span className="text-slate-400">↕</span>
                            </button>
                          </th>
                          <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-xs font-semibold text-slate-600"
                              onClick={() => toggleSort("phone")}
                            >
                              Phone
                              <span className="text-slate-400">↕</span>
                            </button>
                          </th>
                          <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-xs font-semibold text-slate-600"
                              onClick={() => toggleSort("email")}
                            >
                              Email
                              <span className="text-slate-400">↕</span>
                            </button>
                          </th>
                          <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-xs font-semibold text-slate-600"
                              onClick={() => toggleSort("unit")}
                            >
                              Unit
                              <span className="text-slate-400">↕</span>
                            </button>
                          </th>
                          <th className="h-12 px-4 text-right align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTenants.map((t) => (
                          <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 align-middle text-sm text-slate-700">
                              <Link
                                href={`/manager/people/tenants/${t.id}`}
                                className="font-semibold text-slate-900 hover:underline"
                              >
                                {t.name || "Tenant"}
                              </Link>
                            </td>
                            <td className="px-4 py-3 align-middle text-sm text-slate-700 whitespace-nowrap">
                              {t.phone || "—"}
                            </td>
                            <td className="px-4 py-3 align-middle text-sm text-slate-700">
                              {t.email || "—"}
                            </td>
                            <td className="px-4 py-3 align-middle text-sm text-slate-700">
                              {t.unit?.unitNumber || t.unitId || "—"}
                            </td>
                            <td className="px-4 py-3 align-middle text-sm text-slate-700 text-right">
                              <div className="relative inline-block text-left" data-tenant-menu>
                                <button
                                  type="button"
                                  className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                                  onClick={() =>
                                    setMenuOpenId((prev) => (prev === t.id ? null : t.id))
                                  }
                                >
                                  ⋮
                                </button>
                                {menuOpenId === t.id ? (
                                  <div
                                    className="absolute right-0 z-10 mt-2 w-32 origin-top-right rounded-md border border-slate-200 bg-white shadow-lg"
                                  >
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                      onClick={() => {
                                        setMenuOpenId(null);
                                        router.push(`/manager/people/tenants/${t.id}`);
                                      }}
                                    >
                                      Modify
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteTenant(t.id)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
