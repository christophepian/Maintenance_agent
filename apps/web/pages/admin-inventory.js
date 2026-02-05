import { useEffect, useMemo, useState } from "react";

/**
 * Inventory Admin (Slice 4)
 * - No CSS modules (fixes missing ../styles/Form.module.css)
 * - Talks directly to backend API_BASE_URL (defaults to http://127.0.0.1:3001)
 *
 * Endpoints used (backend):
 *   GET /buildings
 *   POST /buildings
 *   GET /buildings/:id/units
 *   POST /buildings/:id/units
 *   GET /units/:id/appliances
 *   POST /units/:id/appliances
 *   GET /asset-models
 *   POST /asset-models
 */

export default function InventoryAdmin() {
    // Inline style object for UI
    const ui = {
      page: { maxWidth: "1100px", margin: "40px auto", padding: "24px", fontFamily: "system-ui" },
      headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" },
      h1: { fontSize: "2.2rem", fontWeight: 700, margin: 0 },
      subtle: { color: "#888", fontSize: "1rem", marginTop: "4px" },
      code: { background: "#f5f5f5", padding: "2px 6px", borderRadius: "4px", fontSize: "0.95em" },
      tabRow: { display: "flex", gap: "16px", marginBottom: "24px" },
      tab: { padding: "10px 18px", borderRadius: "8px", border: "1px solid #ddd", background: "#fafafa", cursor: "pointer", fontWeight: 500 },
      tabActive: { background: "#111", color: "#fff", border: "1px solid #111" },
      section: { marginBottom: "32px" },
      card: { background: "#fff", border: "1px solid #eee", borderRadius: "8px", padding: "18px", marginBottom: "18px" },
      label: { fontWeight: 600, marginRight: "8px" },
      input: { padding: "10px", borderRadius: "8px", border: "1px solid #ddd", width: "320px", marginRight: "10px" },
      btn: { padding: "10px 18px", borderRadius: "8px", border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" },
      error: { color: "crimson", marginTop: "10px" },
      ok: { color: "green", marginTop: "10px" },
    };
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "http://127.0.0.1:3001";

  const [activeTab, setActiveTab] = useState("buildings");

  // Data
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [appliances, setAppliances] = useState([]);
  const [assetModels, setAssetModels] = useState([]);

  // Selection
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  // Forms
  const [buildingName, setBuildingName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [assetModelName, setAssetModelName] = useState("");
  const [assetModelCategory, setAssetModelCategory] = useState("");
  const [applianceName, setApplianceName] = useState("");
  const [applianceCategory, setApplianceCategory] = useState("");
  const [applianceSerialNumber, setApplianceSerialNumber] = useState("");
  const [selectedAssetModelId, setSelectedAssetModelId] = useState("");

  // UX
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null); // { type: "ok" | "err", message: string }

  const tabs = useMemo(
    () => [
      { key: "buildings", label: "Buildings" },
      { key: "units", label: "Units" },
      { key: "asset-models", label: "Asset Models" },
      { key: "appliances", label: "Appliances" },
    ],
    []
  );

  function setOk(message) {
    setNotice({ type: "ok", message });
    setTimeout(() => setNotice(null), 4000);
  }
  function setErr(message) {
    setNotice({ type: "err", message });
  }

  async function fetchJSON(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // ignore parse error – keep raw
    }

    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function loadBuildings() {
    const data = await fetchJSON(`/buildings`);
    setBuildings(Array.isArray(data) ? data : data?.buildings || []);
  }

  async function loadAssetModels() {
    const data = await fetchJSON(`/asset-models`);
    setAssetModels(Array.isArray(data) ? data : data?.assetModels || []);
  }

  async function loadUnits(buildingId) {
    if (!buildingId) {
      setUnits([]);
      return;
    }
    const data = await fetchJSON(`/buildings/${buildingId}/units`);
    setUnits(Array.isArray(data) ? data : data?.units || []);
  }

  async function loadAppliances(unitId) {
    if (!unitId) {
      setAppliances([]);
      return;
    }
    const data = await fetchJSON(`/units/${unitId}/appliances`);
    setAppliances(Array.isArray(data) ? data : data?.appliances || []);
  }

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadBuildings(), loadAssetModels()]);
      } catch (e) {
        setErr(
          `Failed to load inventory. Check API is running on ${API_BASE}. Error: ${e.message}`
        );
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When building changes, refresh units and reset dependent selection
  useEffect(() => {
    (async () => {
      try {
        setSelectedUnitId("");
        setAppliances([]);
        await loadUnits(selectedBuildingId);
      } catch (e) {
        setErr(`Failed to load units: ${e.message}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuildingId]);

  // When unit changes, refresh appliances
  useEffect(() => {
    (async () => {
      try {
        await loadAppliances(selectedUnitId);
      } catch (e) {
        setErr(`Failed to load appliances: ${e.message}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnitId]);

  // Actions
  async function onCreateBuilding(e) {
    e.preventDefault();
    const name = buildingName.trim();
    if (!name) return setErr("Building name is required.");

    try {
      setLoading(true);
      await fetchJSON(`/buildings`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setBuildingName("");
      await loadBuildings();
      setOk("Building created.");
      setActiveTab("buildings");
    } catch (e) {
      setErr(`Create building failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateUnit(e) {
    e.preventDefault();
    const label = unitLabel.trim();
    if (!selectedBuildingId) return setErr("Select a building first.");
    if (!label) return setErr("Unit label is required.");

    try {
      setLoading(true);
      await fetchJSON(`/buildings/${selectedBuildingId}/units`, {
        method: "POST",
        body: JSON.stringify({ label }),
      });
      setUnitLabel("");
      await loadUnits(selectedBuildingId);
      setOk("Unit created.");
      setActiveTab("units");
    } catch (e) {
      setErr(`Create unit failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateAssetModel(e) {
    e.preventDefault();
    const name = assetModelName.trim();
    const category = assetModelCategory.trim();

    if (!name) return setErr("Asset model name is required.");
    // category is optional in many designs; keep optional here, but include if provided.

    try {
      setLoading(true);
      await fetchJSON(`/asset-models`, {
        method: "POST",
        body: JSON.stringify({
          name,
          ...(category ? { category } : {}),
        }),
      });
      setAssetModelName("");
      setAssetModelCategory("");
      await loadAssetModels();
      setOk("Asset model created.");
      setActiveTab("asset-models");
    } catch (e) {
      setErr(`Create asset model failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateAppliance(e) {
    e.preventDefault();
    const name = applianceName.trim();
    const category = applianceCategory.trim();
    const serialNumber = applianceSerialNumber.trim();

    if (!selectedUnitId) return setErr("Select a unit first.");
    if (!name) return setErr("Appliance name is required.");
    if (!category) return setErr("Appliance category is required.");

    // assetModelId optional but recommended
    const assetModelId = selectedAssetModelId || null;

    try {
      setLoading(true);
      await fetchJSON(`/units/${selectedUnitId}/appliances`, {
        method: "POST",
        body: JSON.stringify({
          name,
          category,
          ...(serialNumber ? { serialNumber } : {}),
          ...(assetModelId ? { assetModelId } : {}),
        }),
      });
      setApplianceName("");
      setApplianceCategory("");
      setApplianceSerialNumber("");
      setSelectedAssetModelId("");
      await loadAppliances(selectedUnitId);
      setOk("Appliance created.");
      setActiveTab("appliances");
    } catch (e) {
      setErr(`Create appliance failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  return (
    <div style={ui.page}>
      <div style={ui.headerRow}>
        <div>
          <h1 style={ui.h1}>Admin Inventory</h1>
          <div style={ui.subtle}>
            Backend: <code style={ui.code}>{API_BASE}</code>
          </div>
        </div>
        <div style={ui.badgeRow}>
          {loading ? <span style={ui.badge}>Loading…</span> : null}
        </div>
      </div>

      {notice ? (
        <div
          style={{
            ...ui.notice,
            ...(notice.type === "ok" ? ui.noticeOk : ui.noticeErr),
          }}
        >
          {notice.message}
        </div>
      ) : null}

      <div style={ui.card}>
        <div style={ui.tabsRow}>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                ...ui.tab,
                ...(activeTab === t.key ? ui.tabActive : null),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Shared selectors */}
        <div style={ui.grid2}>
          <div>
            <label style={ui.label}>Building</label>
            <select
              style={ui.input}
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
            >
              <option value="">— Select building —</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div style={ui.help}>
              Selected:{" "}
              <strong>{selectedBuilding ? selectedBuilding.name : "—"}</strong>
            </div>
          </div>

          <div>
            <label style={ui.label}>Unit</label>
            <select
              style={ui.input}
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              disabled={!selectedBuildingId}
            >
              <option value="">
                {selectedBuildingId ? "— Select unit —" : "Select building first"}
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label || u.name || u.id}
                </option>
              ))}
            </select>
            <div style={ui.help}>
              Selected: <strong>{selectedUnit ? selectedUnit.label : "—"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* TAB CONTENT */}
      {activeTab === "buildings" ? (
        <div style={ui.card}>
          <h2 style={ui.h2}>Buildings</h2>

          <form onSubmit={onCreateBuilding} style={ui.formRow}>
            <div style={ui.grow}>
              <label style={ui.label}>New building name</label>
              <input
                style={ui.input}
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder="e.g. Bahnhofstrasse 12"
              />
            </div>
            <button style={ui.primaryBtn} disabled={loading} type="submit">
              Create
            </button>
          </form>

          <div style={ui.list}>
            {buildings.length === 0 ? (
              <div style={ui.empty}>No buildings yet.</div>
            ) : (
              buildings.map((b) => (
                <div key={b.id} style={ui.listRow}>
                  <div>
                    <div style={ui.rowTitle}>{b.name}</div>
                    <div style={ui.subtle}>
                      <code style={ui.codeSmall}>{b.id}</code>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={ui.secondaryBtn}
                    onClick={() => {
                      setSelectedBuildingId(b.id);
                      setActiveTab("units");
                    }}
                  >
                    Manage units →
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "units" ? (
        <div style={ui.card}>
          <h2 style={ui.h2}>Units</h2>

          <form onSubmit={onCreateUnit} style={ui.formRow}>
            <div style={ui.grow}>
              <label style={ui.label}>
                New unit label{" "}
                <span style={ui.subtle}>
                  (Building:{" "}
                  {selectedBuilding ? selectedBuilding.name : "none selected"})
                </span>
              </label>
              <input
                style={ui.input}
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="e.g. Apt 3B"
                disabled={!selectedBuildingId}
              />
            </div>
            <button
              style={ui.primaryBtn}
              disabled={loading || !selectedBuildingId}
              type="submit"
            >
              Create
            </button>
          </form>

          <div style={ui.list}>
            {!selectedBuildingId ? (
              <div style={ui.empty}>Select a building to view units.</div>
            ) : units.length === 0 ? (
              <div style={ui.empty}>No units in this building yet.</div>
            ) : (
              units.map((u) => (
                <div key={u.id} style={ui.listRow}>
                  <div>
                    <div style={ui.rowTitle}>{u.label || u.name || "Unit"}</div>
                    <div style={ui.subtle}>
                      <code style={ui.codeSmall}>{u.id}</code>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={ui.secondaryBtn}
                    onClick={() => {
                      setSelectedUnitId(u.id);
                      setActiveTab("appliances");
                    }}
                  >
                    Manage appliances →
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "asset-models" ? (
        <div style={ui.card}>
          <h2 style={ui.h2}>Asset Models</h2>

          <form onSubmit={onCreateAssetModel} style={ui.formRow}>
            <div style={ui.grow}>
              <label style={ui.label}>Model name</label>
              <input
                style={ui.input}
                value={assetModelName}
                onChange={(e) => setAssetModelName(e.target.value)}
                placeholder="e.g. Bosch Serie 6"
              />
            </div>

            <div style={ui.grow}>
              <label style={ui.label}>Category (optional)</label>
              <input
                style={ui.input}
                value={assetModelCategory}
                onChange={(e) => setAssetModelCategory(e.target.value)}
                placeholder="e.g. dishwasher"
              />
            </div>

            <button style={ui.primaryBtn} disabled={loading} type="submit">
              Create
            </button>
          </form>

          <div style={ui.list}>
            {assetModels.length === 0 ? (
              <div style={ui.empty}>No asset models yet.</div>
            ) : (
              assetModels.map((m) => (
                <div key={m.id} style={ui.listRow}>
                  <div>
                    <div style={ui.rowTitle}>
                      {m.name}{" "}
                      {m.category ? (
                        <span style={ui.pill}>{m.category}</span>
                      ) : null}
                    </div>
                    <div style={ui.subtle}>
                      <code style={ui.codeSmall}>{m.id}</code>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "appliances" ? (
        <div style={ui.card}>
          <h2 style={ui.h2}>Appliances</h2>

          <form onSubmit={onCreateAppliance} style={ui.formCol}>
            <div style={ui.grid2}>
              <div>
                <label style={ui.label}>
                  Appliance name{" "}
                  <span style={ui.subtle}>
                    (Unit: {selectedUnit ? selectedUnit.label : "none selected"})
                  </span>
                </label>
                <input
                  style={ui.input}
                  value={applianceName}
                  onChange={(e) => setApplianceName(e.target.value)}
                  placeholder="e.g. Kitchen Dishwasher"
                  disabled={!selectedUnitId}
                />
              </div>

              <div>
                <label style={ui.label}>Category</label>
                <input
                  style={ui.input}
                  value={applianceCategory}
                  onChange={(e) => setApplianceCategory(e.target.value)}
                  placeholder="e.g. dishwasher"
                  disabled={!selectedUnitId}
                />
              </div>

              <div>
                <label style={ui.label}>Serial number (optional)</label>
                <input
                  style={ui.input}
                  value={applianceSerialNumber}
                  onChange={(e) => setApplianceSerialNumber(e.target.value)}
                  placeholder="e.g. SN123456"
                  disabled={!selectedUnitId}
                />
              </div>

              <div>
                <label style={ui.label}>Asset model (optional)</label>
                <select
                  style={ui.input}
                  value={selectedAssetModelId}
                  onChange={(e) => setSelectedAssetModelId(e.target.value)}
                  disabled={!selectedUnitId}
                >
                  <option value="">— None —</option>
                  {assetModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.category ? ` (${m.category})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={ui.formRow}>
              <button
                style={ui.primaryBtn}
                disabled={loading || !selectedUnitId}
                type="submit"
              >
                Create appliance
              </button>
              <button
                type="button"
                style={ui.secondaryBtn}
                disabled={loading}
                onClick={async () => {
                  try {
                    setLoading(true);
                    await loadAppliances(selectedUnitId);
                    setOk("Appliances refreshed.");
                  } catch (e) {
                    setErr(`Refresh failed: ${e.message}`);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Refresh
              </button>
            </div>
          </form>

          <div style={ui.list}>
            {!selectedUnitId ? (
              <div style={ui.empty}>Select a unit to view appliances.</div>
            ) : appliances.length === 0 ? (
              <div style={ui.empty}>No appliances in this unit yet.</div>
            ) : (
              appliances.map((a) => (
                <div key={a.id} style={ui.listRow}>
                  <div>
                    <div style={ui.rowTitle}>
                      {a.name} <span style={ui.pill}>{a.category}</span>
                    </div>
                    <div style={ui.subtle}>
                      {a.serialNumber ? (
                        <span>
                          SN: <code style={ui.codeSmall}>{a.serialNumber}</code>{" "}
                          •{" "}
                        </span>
                      ) : null}
                      <code style={ui.codeSmall}>{a.id}</code>
                    </div>
                    {a.assetModel ? (
                      <div style={ui.help}>
                        Model: <strong>{a.assetModel.name}</strong>
                        {a.assetModel.category ? ` (${a.assetModel.category})` : ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div style={ui.footer}>
        <div style={ui.subtle}>
          Tip: if this page can’t load data, verify the API is running on{" "}
          <code style={ui.codeSmall}>{API_BASE}</code> and that CORS is enabled.
        </div>
      </div>
    </div>
  );
}

