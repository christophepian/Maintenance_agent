export default function ContractorsPage() {
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

  React.useEffect(() => {
    fetchContractors();
  }, []);

  async function fetchContractors() {
    setLoading(true);
    try {
      const res = await fetch("/api/contractors");
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
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`/api/contractors/${id}`, { method: "DELETE" });
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

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: "16px", fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>Contractors</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Manage contractors and their service areas.</p>

      {message && (
        <div style={{ padding: 12, marginBottom: 16, backgroundColor: "#f0f0f0", borderRadius: 4 }}>
          {message}
        </div>
      )}

      <button
        onClick={() => setFormVisible(!formVisible)}
        style={{
          padding: "8px 16px",
          marginBottom: 16,
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        {formVisible ? "Cancel" : "Add Contractor"}
      </button>

      {formVisible && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: 12,
            marginBottom: 24,
            padding: 16,
            backgroundColor: "#f9f9f9",
            borderRadius: 4,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>Name</div>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Contractor name"
              required
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>Phone</div>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+41 XX XXX XXXX"
              required
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>Email</div>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="contractor@example.com"
              required
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>Hourly Rate (CHF)</div>
            <input
              type="number"
              value={formData.hourlyRate}
              onChange={(e) => setFormData((prev) => ({ ...prev, hourlyRate: parseInt(e.target.value) }))}
              min="10"
              max="500"
            />
          </label>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>Service Categories</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {categories.map((cat) => (
                <label key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
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

          <button
            type="submit"
            style={{
              padding: "8px 16px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Save Contractor
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading contractors...</p>
      ) : contractors.length === 0 ? (
        <p>No contractors yet. Add one to get started.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {contractors.map((c) => (
            <div
              key={c.id}
              style={{
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 4,
                backgroundColor: c.isActive ? "#fff" : "#f5f5f5",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0" }}>{c.name}</h3>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", color: "#666" }}>
                    {c.phone} | {c.email}
                  </p>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", color: "#666" }}>
                    CHF {c.hourlyRate}/hr
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#999" }}>
                    Categories: {c.serviceCategories.join(", ")}
                  </p>
                  {!c.isActive && (
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#c00" }}>
                      ⚠️ Deactivated
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  style={{
                    padding: "4px 12px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React from "react";
