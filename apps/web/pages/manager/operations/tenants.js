import { useEffect, useState } from "react";
import AppShell from "../../../components/AppShell";

export default function ManagerTenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [contractorFormVisible, setContractorFormVisible] = useState(false);
  const [contractorForm, setContractorForm] = useState({
    name: "",
    phone: "",
    email: "",
    hourlyRate: 50,
    serviceCategories: [],
  });
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

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/tenants", { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || data?.error || "Failed to load tenants");
        }
        setTenants(data?.data || []);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function toggleCategory(cat) {
    setContractorForm((prev) => ({
      ...prev,
      serviceCategories: prev.serviceCategories.includes(cat)
        ? prev.serviceCategories.filter((c) => c !== cat)
        : [...prev.serviceCategories, cat],
    }));
  }

  async function handleCreateContractor(e) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await fetch("/api/contractors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(contractorForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to create contractor");
      }
      setMessage("Contractor created successfully.");
      setContractorForm({
        name: "",
        phone: "",
        email: "",
        hourlyRate: 50,
        serviceCategories: [],
      });
      setContractorFormVisible(false);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  return (
    <AppShell role="MANAGER">
      <div style={{ maxWidth: "900px" }}>
        <h1 style={{ marginTop: 0 }}>Tenants</h1>
        <p style={{ color: "#666" }}>Tenant list (read-only).</p>

        {message ? (
          <div style={{ padding: "12px", background: "#e8f5e9", border: "1px solid #81c784", marginBottom: "16px" }}>
            {message}
          </div>
        ) : null}

        {error ? (
          <div style={{ padding: "12px", background: "#ffecec", border: "1px solid #ffb3b3", marginBottom: "16px" }}>
            {error}
          </div>
        ) : null}

        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setContractorFormVisible(!contractorFormVisible)}
            className="button-primary"
            style={{ marginBottom: 12 }}
          >
            {contractorFormVisible ? "Cancel" : "Add tenant"}
          </button>
          {contractorFormVisible ? (
            <form onSubmit={handleCreateContractor} className="card" style={{ display: "grid", gap: 12 }}>
              <label className="label">
                Name
                <input
                  className="input"
                  type="text"
                  value={contractorForm.name}
                  onChange={(e) => setContractorForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Contractor name"
                  required
                />
              </label>
              <label className="label">
                Phone
                <input
                  className="input"
                  type="tel"
                  value={contractorForm.phone}
                  onChange={(e) => setContractorForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+41 XX XXX XXXX"
                  required
                />
              </label>
              <label className="label">
                Email
                <input
                  className="input"
                  type="email"
                  value={contractorForm.email}
                  onChange={(e) => setContractorForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="contractor@example.com"
                  required
                />
              </label>
              <label className="label">
                Hourly Rate (CHF)
                <input
                  className="input"
                  type="number"
                  value={contractorForm.hourlyRate}
                  onChange={(e) => setContractorForm((prev) => ({ ...prev, hourlyRate: parseInt(e.target.value, 10) }))}
                  min="10"
                  max="500"
                />
              </label>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Service Categories</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {categories.map((cat) => (
                    <label key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={contractorForm.serviceCategories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="button-primary">
                Save Contractor
              </button>
            </form>
          ) : null}
        </div>

        {loading ? (
          <p>Loading tenants...</p>
        ) : tenants.length === 0 ? (
          <p>No tenants yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {tenants.map((t) => (
              <div key={t.id} style={{ padding: 14, border: "1px solid #e5e5e5", borderRadius: 8, background: "#fff" }}>
                <div style={{ fontWeight: 600 }}>{t.name || "Tenant"}</div>
                <div style={{ color: "#666", fontSize: 14 }}>{t.phone || "—"}</div>
                <div style={{ color: "#888", fontSize: 12 }}>
                  Unit: {t.unit?.unitNumber || t.unitId || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
