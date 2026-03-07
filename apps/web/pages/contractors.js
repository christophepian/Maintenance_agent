import React from "react";
import { ALLOWED_CATEGORIES } from "../lib/categories";
import Link from "next/link";
import { useRouter } from "next/router";
import AppShell from "../components/AppShell";
import PageShell from "../components/layout/PageShell";
import PageHeader from "../components/layout/PageHeader";
import PageContent from "../components/layout/PageContent";
import Panel from "../components/layout/Panel";
import { authHeaders } from "../lib/api";

export default function ContractorsPage() {
  const router = useRouter();
  const [contractors, setContractors] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [formVisible, setFormVisible] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    city: "",
    country: "CH",
    iban: "",
    vatNumber: "",
    defaultVatRate: "7.7",
    hourlyRate: 50,
    serviceCategories: [],
  });
  const [contractorSearch, setContractorSearch] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [menuOpenId, setMenuOpenId] = React.useState(null);
  const [sortKey, setSortKey] = React.useState("name");
  const [sortDir, setSortDir] = React.useState("asc");
  const categories = ALLOWED_CATEGORIES;

  React.useEffect(() => {
    fetchContractors();
  }, []);

  React.useEffect(() => {
    if (!menuOpenId) return;

    function handleClickOutside(event) {
      if (event.target.closest("[data-contractor-menu]")) return;
      setMenuOpenId(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  async function fetchContractors() {
    setLoading(true);
    try {
      const res = await fetch("/api/contractors", { headers: authHeaders() });
      const json = await res.json();
      if (json.data) setContractors(json.data);
    } catch (e) {
      setMessage(`Error: ${String(e)}`);
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        addressLine1: formData.addressLine1.trim(),
        addressLine2: formData.addressLine2.trim() || undefined,
        postalCode: formData.postalCode.trim(),
        city: formData.city.trim(),
        country: formData.country.trim() || "CH",
        iban: formData.iban.trim(),
        vatNumber: formData.vatNumber.trim() || undefined,
        defaultVatRate: formData.defaultVatRate ? Number(formData.defaultVatRate) : undefined,
        hourlyRate: formData.hourlyRate,
        serviceCategories: formData.serviceCategories,
      };
      const res = await fetch("/api/contractors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage("Contractor added successfully");
        setFormData({
          name: "",
          phone: "",
          email: "",
          addressLine1: "",
          addressLine2: "",
          postalCode: "",
          city: "",
          country: "CH",
          iban: "",
          vatNumber: "",
          defaultVatRate: "7.7",
          hourlyRate: 50,
          serviceCategories: [],
        });
        setFormVisible(false);
        await fetchContractors();
      } else {
        setMessage(`Error: ${json.error?.message || "Failed to add contractor"}`);
      }
    } catch (e) {
      setMessage(`Error: ${String(e)}`);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Deactivate this contractor?")) return;
    try {
      const res = await fetch(`/api/contractors/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        setMessage("Contractor deactivated");
        await fetchContractors();
        setMenuOpenId(null);
      } else {
        setMessage("Error deactivating contractor");
      }
    } catch (e) {
      setMessage(`Error: ${String(e)}`);
    }
  }

  function toggleCategory(cat) {
    setFormData((prev) => ({
      ...prev,
      serviceCategories: prev.serviceCategories.includes(cat)
        ? prev.serviceCategories.filter((c) => c !== cat)
        : [...prev.serviceCategories, cat],
    }));
  }

  const filteredContractors = contractors.filter((c) => {
    const query = contractorSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      (c.name || "").toLowerCase().includes(query) ||
      (c.phone || "").toLowerCase().includes(query) ||
      (c.email || "").toLowerCase().includes(query) ||
      (c.addressLine1 || "").toLowerCase().includes(query) ||
      (c.addressLine2 || "").toLowerCase().includes(query) ||
      (c.postalCode || "").toLowerCase().includes(query) ||
      (c.city || "").toLowerCase().includes(query) ||
      (c.country || "").toLowerCase().includes(query) ||
      (c.iban || "").toLowerCase().includes(query) ||
      (c.vatNumber || "").toLowerCase().includes(query) ||
      String(c.hourlyRate || "").toLowerCase().includes(query) ||
      (Array.isArray(c.serviceCategories) ? c.serviceCategories.join(", ") : "")
        .toLowerCase()
        .includes(query) ||
      (c.id || "").toLowerCase().includes(query)
    );
  });

  const sortedContractors = [...filteredContractors].sort((a, b) => {
    const getValue = (c) => {
      switch (sortKey) {
        case "phone":
          return c.phone || "";
        case "email":
          return c.email || "";
        case "rate":
          return c.hourlyRate ?? 0;
        case "categories":
          return Array.isArray(c.serviceCategories)
            ? c.serviceCategories.join(", ")
            : "";
        case "name":
        default:
          return c.name || "";
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

  const content = (
    <PageShell variant="embedded">
      <PageHeader
        title="Contractors"
        subtitle="Manage contractors and their service areas."
        actions={(
          <button
            onClick={() => setFormVisible(!formVisible)}
            className="button-primary"
          >
            {formVisible ? "Cancel" : "Add Contractor"}
          </button>
        )}
      />
      <PageContent>
        {message && (
          <Panel>
            <div className="text-sm text-slate-700">{message}</div>
          </Panel>
        )}

        {formVisible && (
          <Panel title="Add contractor">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <label className="label">
                Name
                <input
                  className="input"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Contractor name"
                  required
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
                  placeholder="contractor@example.com"
                  required
                />
              </label>
              <label className="label">
                Address line 1
                <input
                  className="input"
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData((prev) => ({ ...prev, addressLine1: e.target.value }))}
                  placeholder="Street and number"
                  required
                />
              </label>
              <label className="label">
                Address line 2
                <input
                  className="input"
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData((prev) => ({ ...prev, addressLine2: e.target.value }))}
                  placeholder="Suite, floor, etc."
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="label">
                  Postal code
                  <input
                    className="input"
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
                    required
                  />
                </label>
                <label className="label">
                  City
                  <input
                    className="input"
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    required
                  />
                </label>
                <label className="label">
                  Country
                  <input
                    className="input"
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                  />
                </label>
              </div>
              <label className="label">
                IBAN
                <input
                  className="input"
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData((prev) => ({ ...prev, iban: e.target.value }))}
                  placeholder="CH93 0076 2011 6238 5295 7"
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="label">
                  VAT number
                  <input
                    className="input"
                    type="text"
                    value={formData.vatNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, vatNumber: e.target.value }))}
                    placeholder="CHE-123.456.789"
                  />
                </label>
                <label className="label">
                  Default VAT rate (%)
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    value={formData.defaultVatRate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, defaultVatRate: e.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="label">
                Hourly Rate (CHF)
                <input
                  className="input"
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      hourlyRate: parseInt(e.target.value, 10),
                    }))
                  }
                  min="10"
                  max="500"
                />
              </label>
              <div>
                <div className="label mb-2">Service Categories</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {categories.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.serviceCategories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="button-primary">
                  Save Contractor
                </button>
              </div>
            </form>
          </Panel>
        )}

        <Panel title="All contractors">
          {loading ? (
            <p className="text-sm text-slate-600">Loading contractors...</p>
          ) : contractors.length === 0 ? (
            <p className="text-sm text-slate-600">No contractors yet. Add one to get started.</p>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <div className="max-w-sm w-full">
                  <input
                    className="input"
                    value={contractorSearch}
                    onChange={(e) => setContractorSearch(e.target.value)}
                    placeholder="Search…"
                  />
                </div>
              </div>
              {filteredContractors.length === 0 ? (
                <p className="text-sm text-slate-600">No contractors match that search.</p>
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
                            onClick={() => toggleSort("rate")}
                          >
                            Hourly rate
                            <span className="text-slate-400">↕</span>
                          </button>
                        </th>
                        <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-xs font-semibold text-slate-600"
                            onClick={() => toggleSort("categories")}
                          >
                            Categories
                            <span className="text-slate-400">↕</span>
                          </button>
                        </th>
                        <th className="h-12 px-4 text-right align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedContractors.map((c) => (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 align-middle text-sm text-slate-700">
                            <Link
                              href={`/manager/people/vendors/${c.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {c.name}
                            </Link>
                            {!c.isActive ? (
                              <div className="mt-1 text-xs text-red-600">⚠️ Deactivated</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-middle text-sm text-slate-700 whitespace-nowrap">
                            {c.phone || "—"}
                          </td>
                          <td className="px-4 py-3 align-middle text-sm text-slate-700">
                            {c.email || "—"}
                          </td>
                          <td className="px-4 py-3 align-middle text-sm text-slate-700">
                            CHF {c.hourlyRate || 0}/hr
                          </td>
                          <td className="px-4 py-3 align-middle text-sm text-slate-700">
                            {Array.isArray(c.serviceCategories) && c.serviceCategories.length
                              ? c.serviceCategories.join(", ")
                              : "—"}
                          </td>
                          <td className="px-4 py-3 align-middle text-sm text-slate-700 text-right">
                            <div className="relative inline-block text-left" data-contractor-menu>
                              <button
                                type="button"
                                className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                                onClick={() =>
                                  setMenuOpenId((prev) => (prev === c.id ? null : c.id))
                                }
                              >
                                ⋮
                              </button>
                              {menuOpenId === c.id ? (
                                <div className="absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-md border border-slate-200 bg-white shadow-lg">
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => {
                                      setMenuOpenId(null);
                                      router.push(`/manager/people/vendors/${c.id}`);
                                    }}
                                  >
                                    Modify
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                    onClick={() => handleDelete(c.id)}
                                  >
                                    Deactivate
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
  );

  if (router.pathname === "/contractors") {
    return <AppShell role="MANAGER">{content}</AppShell>;
  }

  return content;
}
