
import React from "react";
import { useRouter } from "next/router";
import AppShell from "../components/AppShell";
import PageShell from "../components/layout/PageShell";
import PageHeader from "../components/layout/PageHeader";
import PageContent from "../components/layout/PageContent";
import Panel from "../components/layout/Panel";

export default function ContractorsPage() {
  const router = useRouter();
  const [contractors, setContractors] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [formVisible, setFormVisible] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    phone: "",
    email: "",
    hourlyRate: 50,
    serviceCategories: [],
  });
  const [message, setMessage] = React.useState("");
  const categories = ["stove", "oven", "dishwasher", "bathroom", "lighting"];

  function authHeaders() {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("authToken");
    if (token) return { Authorization: `Bearer ${token}` };
    const role = localStorage.getItem("role") || "MANAGER";
    return {
      "x-dev-role": role,
      "x-dev-org-id": "default-org",
      "x-dev-user-id": "dev-user",
      "x-dev-email": "dev@local",
    };
  }
  React.useEffect(() => {
    fetchContractors();
  }, []);
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
      const res = await fetch("/api/contractors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage("Contractor added successfully");
        setFormData({
          name: "",
          phone: "",
          email: "",
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
                Hourly Rate (CHF)
                <input
                  className="input"
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, hourlyRate: parseInt(e.target.value) }))}
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
            <div className="grid gap-4">
              {contractors.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg border px-4 py-3 ${c.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50"}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{c.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {c.phone} | {c.email}
                      </p>
                      <p className="text-sm text-slate-600">CHF {c.hourlyRate}/hr</p>
                      <p className="text-xs text-slate-500">
                        Categories: {c.serviceCategories.join(", ")}
                      </p>
                      {!c.isActive && (
                        <p className="mt-2 text-xs text-red-600">\u26a0\ufe0f Deactivated</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="button-secondary"
                      style={{ background: "#dc3545", color: "white", fontSize: 12, padding: "4px 12px" }}
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
