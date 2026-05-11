/**
 * CreateBuildingModal
 *
 * Extracted building creation form — same fields as the inline form on
 * /manager/inventory. Reusable anywhere a building may need to be created
 * on the fly (e.g. the imported statement review page).
 *
 * Props:
 *   onCreated(building) — called with the new building object on success
 *   onClose()           — called when the modal should be dismissed
 */

import { useState } from "react";
import { authHeaders } from "../lib/api";
import { Modal, ModalFooter } from "./ui/Modal";

export default function CreateBuildingModal({ onCreated, onClose }) {
  const [address, setAddress]     = useState("");
  const [cityCode, setCityCode]   = useState("");
  const [city, setCity]           = useState("");
  const [country, setCountry]     = useState("Switzerland");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const addressLine = address.trim();
    const code        = cityCode.trim();
    const cityName    = city.trim();
    const countryName = country.trim();

    if (!addressLine) return setError("Address is required.");
    if (!code)        return setError("City code is required.");
    if (!cityName)    return setError("City is required.");
    if (!countryName) return setError("Country is required.");

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name:    addressLine,
          address: `${addressLine}, ${code} ${cityName}, ${countryName}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to create building");
      onCreated(json.data ?? json);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New building" onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Address</label>
          <input
            className="form-input w-full"
            placeholder="e.g. Bahnhofstrasse 12"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">City code</label>
            <input
              className="form-input w-full"
              placeholder="e.g. 8001"
              value={cityCode}
              onChange={(e) => setCityCode(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">City</label>
            <input
              className="form-input w-full"
              placeholder="e.g. Zürich"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="form-label">Country</label>
          <input
            className="form-input w-full"
            placeholder="e.g. Switzerland"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive-text">{error}</p>}

        <ModalFooter>
          <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={saving}>
            {saving ? "Saving…" : "Create building"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
