import { useState, useEffect } from "react";
import styles from "../styles/Form.module.css";

export default function InventoryAdmin() {
  const [activeTab, setActiveTab] = useState("buildings");
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [appliances, setAppliances] = useState([]);
  const [assetModels, setAssetModels] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form states
  const [buildingForm, setBuildingForm] = useState({ name: "", address: "" });
  const [unitForm, setUnitForm] = useState({ unitNumber: "", floor: "" });
  const [applianceForm, setApplianceForm] = useState({
    name: "",
    serial: "",
    assetModelId: "",
  });
  const [assetModelForm, setAssetModelForm] = useState({
    manufacturer: "",
    model: "",
    category: "",
  });

  // Fetch buildings on mount
  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    try {
      const response = await fetch("/api/inventory/buildings");
      const data = await response.json();
      if (data.data) {
        setBuildings(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch buildings:", e);
    }
  };

  const fetchUnits = async (buildingId) => {
    if (!buildingId) return;
    try {
      const response = await fetch(`/api/inventory/buildings/${buildingId}/units`);
      const data = await response.json();
      if (data.data) {
        setUnits(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch units:", e);
    }
  };

  const fetchAppliances = async (unitId) => {
    if (!unitId) return;
    try {
      const response = await fetch(`/api/inventory/units/${unitId}/appliances`);
      const data = await response.json();
      if (data.data) {
        setAppliances(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch appliances:", e);
    }
  };

  const fetchAssetModels = async () => {
    try {
      const response = await fetch("/api/inventory/asset-models");
      const data = await response.json();
      if (data.data) {
        setAssetModels(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch asset models:", e);
    }
  };

  const handleCreateBuilding = async (e) => {
    e.preventDefault();
    if (!buildingForm.name || !buildingForm.address) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/inventory/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildingForm),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || "Failed to create building");
        return;
      }

      setSuccess("Building created successfully");
      setBuildingForm({ name: "", address: "" });
      fetchBuildings();
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUnit = async (e) => {
    e.preventDefault();
    if (!selectedBuilding || !unitForm.unitNumber) {
      setError("Please select a building and enter a unit number");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/inventory/buildings/${selectedBuilding}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unitForm),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || "Failed to create unit");
        return;
      }

      setSuccess("Unit created successfully");
      setUnitForm({ unitNumber: "", floor: "" });
      fetchUnits(selectedBuilding);
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppliance = async (e) => {
    e.preventDefault();
    if (!selectedUnit || !applianceForm.name) {
      setError("Please select a unit and enter an appliance name");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/inventory/units/${selectedUnit}/appliances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applianceForm),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || "Failed to create appliance");
        return;
      }

      setSuccess("Appliance created successfully");
      setApplianceForm({ name: "", serial: "", assetModelId: "" });
      fetchAppliances(selectedUnit);
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssetModel = async (e) => {
    e.preventDefault();
    if (!assetModelForm.manufacturer || !assetModelForm.model || !assetModelForm.category) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/inventory/asset-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assetModelForm),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || "Failed to create asset model");
        return;
      }

      setSuccess("Asset model created successfully");
      setAssetModelForm({ manufacturer: "", model: "", category: "" });
      fetchAssetModels();
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Inventory Admin</h1>

      <div className={styles.tabs}>
        {["buildings", "units", "appliances", "asset-models"].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setError("");
              setSuccess("");
              if (tab === "asset-models") fetchAssetModels();
            }}
            className={activeTab === tab ? styles.tabActive : styles.tabInactive}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace("-", " ")}
          </button>
        ))}
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {/* Buildings Tab */}
      {activeTab === "buildings" && (
        <div className={styles.section}>
          <h2>Buildings</h2>

          <form onSubmit={handleCreateBuilding} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="building-name">Building Name</label>
              <input
                id="building-name"
                value={buildingForm.name}
                onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                placeholder="e.g., 123 Main St"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="building-address">Address</label>
              <input
                id="building-address"
                value={buildingForm.address}
                onChange={(e) => setBuildingForm({ ...buildingForm, address: e.target.value })}
                placeholder="e.g., 123 Main Street, Zurich"
                className={styles.input}
              />
            </div>

            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? "Creating..." : "Add Building"}
            </button>
          </form>

          <div className={styles.list}>
            <h3>Existing Buildings</h3>
            {buildings.length === 0 ? (
              <p>No buildings yet</p>
            ) : (
              <ul>
                {buildings.map((b) => (
                  <li key={b.id}>
                    <strong>{b.name}</strong> - {b.address}
                    <small>
                      {b.units?.length || 0} units
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Units Tab */}
      {activeTab === "units" && (
        <div className={styles.section}>
          <h2>Units</h2>

          <div className={styles.formGroup}>
            <label htmlFor="select-building">Select Building</label>
            <select
              id="select-building"
              value={selectedBuilding}
              onChange={(e) => {
                setSelectedBuilding(e.target.value);
                setSelectedUnit("");
                if (e.target.value) fetchUnits(e.target.value);
              }}
              className={styles.input}
            >
              <option value="">-- Choose a building --</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {selectedBuilding && (
            <form onSubmit={handleCreateUnit} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="unit-number">Unit Number</label>
                <input
                  id="unit-number"
                  value={unitForm.unitNumber}
                  onChange={(e) => setUnitForm({ ...unitForm, unitNumber: e.target.value })}
                  placeholder="e.g., 3A or 201"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="unit-floor">Floor (optional)</label>
                <input
                  id="unit-floor"
                  value={unitForm.floor}
                  onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
                  placeholder="e.g., 3 or Ground"
                  className={styles.input}
                />
              </div>

              <button type="submit" disabled={loading} className={styles.button}>
                {loading ? "Creating..." : "Add Unit"}
              </button>
            </form>
          )}

          <div className={styles.list}>
            <h3>Units in Selected Building</h3>
            {units.length === 0 ? (
              <p>No units yet</p>
            ) : (
              <ul>
                {units.map((u) => (
                  <li key={u.id}>
                    <strong>{u.unitNumber}</strong>
                    {u.floor && ` - Floor ${u.floor}`}
                    <small>
                      {u.appliances?.length || 0} appliances
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Appliances Tab */}
      {activeTab === "appliances" && (
        <div className={styles.section}>
          <h2>Appliances</h2>

          <div className={styles.formGroup}>
            <label htmlFor="select-unit">Select Unit</label>
            <select
              id="select-unit"
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                if (e.target.value) fetchAppliances(e.target.value);
              }}
              className={styles.input}
            >
              <option value="">-- Choose a unit --</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </select>
          </div>

          {selectedUnit && (
            <form onSubmit={handleCreateAppliance} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="appliance-name">Appliance Name</label>
                <input
                  id="appliance-name"
                  value={applianceForm.name}
                  onChange={(e) => setApplianceForm({ ...applianceForm, name: e.target.value })}
                  placeholder="e.g., Kitchen Stove"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="appliance-serial">Serial Number (optional)</label>
                <input
                  id="appliance-serial"
                  value={applianceForm.serial}
                  onChange={(e) => setApplianceForm({ ...applianceForm, serial: e.target.value })}
                  placeholder="e.g., SN123456"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="asset-model">Asset Model (optional)</label>
                <select
                  id="asset-model"
                  value={applianceForm.assetModelId}
                  onChange={(e) => setApplianceForm({ ...applianceForm, assetModelId: e.target.value })}
                  className={styles.input}
                >
                  <option value="">-- Select or skip --</option>
                  {assetModels.map((am) => (
                    <option key={am.id} value={am.id}>
                      {am.manufacturer} {am.model}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={loading} className={styles.button}>
                {loading ? "Creating..." : "Add Appliance"}
              </button>
            </form>
          )}

          <div className={styles.list}>
            <h3>Appliances in Selected Unit</h3>
            {appliances.length === 0 ? (
              <p>No appliances yet</p>
            ) : (
              <ul>
                {appliances.map((a) => (
                  <li key={a.id}>
                    <strong>{a.name}</strong>
                    {a.serial && ` (SN: ${a.serial})`}
                    {a.assetModel && (
                      <div>
                        {a.assetModel.manufacturer} {a.assetModel.model}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Asset Models Tab */}
      {activeTab === "asset-models" && (
        <div className={styles.section}>
          <h2>Asset Models (Device Catalog)</h2>

          <form onSubmit={handleCreateAssetModel} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="manufacturer">Manufacturer</label>
              <input
                id="manufacturer"
                value={assetModelForm.manufacturer}
                onChange={(e) => setAssetModelForm({ ...assetModelForm, manufacturer: e.target.value })}
                placeholder="e.g., Bosch"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="model">Model</label>
              <input
                id="model"
                value={assetModelForm.model}
                onChange={(e) => setAssetModelForm({ ...assetModelForm, model: e.target.value })}
                placeholder="e.g., SMS68TX06E"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={assetModelForm.category}
                onChange={(e) => setAssetModelForm({ ...assetModelForm, category: e.target.value })}
                className={styles.input}
              >
                <option value="">-- Select category --</option>
                <option value="stove">Stove</option>
                <option value="oven">Oven</option>
                <option value="dishwasher">Dishwasher</option>
                <option value="bathroom">Bathroom</option>
                <option value="lighting">Lighting</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? "Creating..." : "Add Asset Model"}
            </button>
          </form>

          <div className={styles.list}>
            <h3>Existing Models</h3>
            {assetModels.length === 0 ? (
              <p>No asset models yet</p>
            ) : (
              <ul>
                {assetModels.map((am) => (
                  <li key={am.id}>
                    <strong>{am.manufacturer} {am.model}</strong>
                    <small>{am.category}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
