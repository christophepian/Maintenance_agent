
import React from "react";

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
    <div className="main-container">
      <h1>Contractors</h1>
      <p className="subtle">Manage contractors and their service areas.</p>
      {message && (
        <div className="notice" style={{ marginBottom: 16 }}>{message}</div>
      )}
      <button
        onClick={() => setFormVisible(!formVisible)}
        className="button-primary"
        style={{ marginBottom: 16 }}
      >
        {formVisible ? "Cancel" : "Add Contractor"}
      </button>
      {formVisible && (
        <form onSubmit={handleSubmit} className="card" style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
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
            <div className="label" style={{ marginBottom: 6 }}>Service Categories</div>
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
          <button type="submit" className="button-primary">
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
              className="card"
              style={{ background: c.isActive ? undefined : "#f5f5f5" }}
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
                      \u26a0\ufe0f Deactivated
                    </p>
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
    </div>
  );
}
