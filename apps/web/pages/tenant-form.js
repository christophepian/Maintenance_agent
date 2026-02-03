import { useState, useEffect } from "react";
import styles from "../styles/Form.module.css";

export default function TenantForm() {
  const [phone, setPhone] = useState("");
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedAppliance, setSelectedAppliance] = useState("");

  // Normalize phone input to E.164 format
  const normalizePhone = (input) => {
    // Remove all non-numeric characters except +
    let cleaned = input.replace(/[^\d+]/g, "");

    // If starts with +, keep it; otherwise add it
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }

    // Swiss default: if +41 not present and input starts with 0, replace with +41
    if (!cleaned.includes("41") && cleaned.startsWith("+0")) {
      cleaned = "+41" + cleaned.substring(2);
    } else if (!cleaned.includes("41") && cleaned.startsWith("+")) {
      // For other countries, keep as-is
    }

    return cleaned;
  };

  const handlePhoneChange = (e) => {
    const normalized = normalizePhone(e.target.value);
    setPhone(normalized);
    setError("");
    setTenant(null);
  };

  const handleLookupTenant = async () => {
    if (!phone || phone.length < 5) {
      setError("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/tenants?phone=${encodeURIComponent(phone)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || "Failed to lookup tenant");
        setTenant(null);
        setLoading(false);
        return;
      }

      setTenant(data.data);
      setSelectedAppliance("");
      setSuccess(`Tenant found: ${data.data.name || "No name"}`);
    } catch (e) {
      setError(`Error: ${e.message}`);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleLookupTenant();
    }
  };

  return (
    <div className={styles.container}>
      <h1>Tenant Request Form</h1>

      {/* Phone Lookup Section */}
      <div className={styles.section}>
        <h2>Who are you?</h2>
        <p className={styles.hint}>Enter your phone number to get started</p>

        <div className={styles.formGroup}>
          <label htmlFor="phone">Phone Number (e.g., +41 79 312 3456)</label>
          <input
            id="phone"
            type="tel"
            placeholder="+41 79 312 3456"
            value={phone}
            onChange={handlePhoneChange}
            onKeyPress={handleKeyPress}
            disabled={loading}
            className={styles.input}
          />
        </div>

        <button
          onClick={handleLookupTenant}
          disabled={loading || !phone}
          className={styles.button}
        >
          {loading ? "Looking up..." : "Find My Unit"}
        </button>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}
      </div>

      {/* Tenant & Unit Info Section */}
      {tenant && (
        <div className={styles.section}>
          <h2>Your Information</h2>

          <div className={styles.infoBox}>
            <div className={styles.infoRow}>
              <strong>Phone:</strong>
              <span>{tenant.phone}</span>
            </div>
            {tenant.name && (
              <div className={styles.infoRow}>
                <strong>Name:</strong>
                <span>{tenant.name}</span>
              </div>
            )}
            {tenant.email && (
              <div className={styles.infoRow}>
                <strong>Email:</strong>
                <span>{tenant.email}</span>
              </div>
            )}
            {tenant.unit && (
              <>
                <div className={styles.infoRow}>
                  <strong>Unit:</strong>
                  <span>{tenant.unit.unitNumber}{tenant.unit.floor ? ` (Floor ${tenant.unit.floor})` : ""}</span>
                </div>
              </>
            )}
          </div>

          {/* Appliances Section */}
          {tenant.appliances && tenant.appliances.length > 0 && (
            <div className={styles.formGroup}>
              <label htmlFor="appliance">What needs repair? (optional)</label>
              <select
                id="appliance"
                value={selectedAppliance}
                onChange={(e) => setSelectedAppliance(e.target.value)}
                className={styles.input}
              >
                <option value="">-- Select an appliance --</option>
                {tenant.appliances.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                    {app.assetModel
                      ? ` (${app.assetModel.manufacturer} ${app.assetModel.model})`
                      : ""}
                  </option>
                ))}
              </select>
              {selectedAppliance && tenant.appliances.find((a) => a.id === selectedAppliance)?.serial && (
                <p className={styles.hint}>
                  Serial: {tenant.appliances.find((a) => a.id === selectedAppliance).serial}
                </p>
              )}
            </div>
          )}

          {tenant.appliances && tenant.appliances.length === 0 && (
            <p className={styles.hint}>No appliances registered for your unit yet.</p>
          )}

          {/* Next Step Button */}
          <button className={styles.button + " " + styles.primary}>
            Create Maintenance Request →
          </button>
        </div>
      )}

      {/* Instructions */}
      {!tenant && (
        <div className={styles.section}>
          <h3>How it works:</h3>
          <ol>
            <li>Enter your phone number</li>
            <li>We'll find your unit and list your appliances</li>
            <li>Select which appliance needs repair</li>
            <li>Describe the issue and submit</li>
            <li>A contractor will be assigned automatically</li>
          </ol>
        </div>
      )}
    </div>
  );
}
