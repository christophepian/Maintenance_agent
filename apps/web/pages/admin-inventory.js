import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../components/AppShell";
import { ALLOWED_CATEGORIES } from "../lib/categories";
import PageShell from "../components/layout/PageShell";
import PageHeader from "../components/layout/PageHeader";
import PageContent from "../components/layout/PageContent";

import { cn } from "../lib/utils";
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
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";


  // Data
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [appliances, setAppliances] = useState([]);
  const [assetModels, setAssetModels] = useState([]);
  const [unitTenants, setUnitTenants] = useState([]);
  const [tenantsList, setTenantsList] = useState([]);

  // Selection
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [buildingSearch, setBuildingSearch] = useState("");
  const [buildingMenuOpenId, setBuildingMenuOpenId] = useState(null);

  // Forms
  const [buildingFormVisible, setBuildingFormVisible] = useState(false);
  const [unitFormVisible, setUnitFormVisible] = useState(false);
  const [buildingSortKey, setBuildingSortKey] = useState("name");
  const [buildingSortDir, setBuildingSortDir] = useState("asc");
  const [buildingsTableExpanded, setBuildingsTableExpanded] = useState(false);
  const [buildingAddress, setBuildingAddress] = useState("");
  const [buildingCityCode, setBuildingCityCode] = useState("");
  const [buildingCity, setBuildingCity] = useState("");
  const [buildingCountry, setBuildingCountry] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [assetModelName, setAssetModelName] = useState("");
  const [assetModelCategory, setAssetModelCategory] = useState(ALLOWED_CATEGORIES[0] || "");
  const [applianceName, setApplianceName] = useState("");
  const [applianceCategory, setApplianceCategory] = useState("");
  const [applianceSerialNumber, setApplianceSerialNumber] = useState("");
  const [selectedAssetModelId, setSelectedAssetModelId] = useState("");
  const [createTenantName, setCreateTenantName] = useState("");
  const [createTenantPhone, setCreateTenantPhone] = useState("");
  const [createTenantEmail, setCreateTenantEmail] = useState("");
  const [creatingTenant, setCreatingTenant] = useState(false);

  // UX
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null); // { type: "ok" | "err", message: string }


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
        data?.error?.message ||
        (typeof data?.error === "string" ? data.error : null) ||
        data?.message ||
        `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function loadBuildings() {
    const data = await fetchJSON(`/buildings`);
    setBuildings(Array.isArray(data) ? data : data?.data || []);
  }

  async function loadAssetModels() {
    const data = await fetchJSON(`/asset-models`);
    setAssetModels(Array.isArray(data) ? data : data?.data || []);
  }

  async function loadUnits(buildingId) {
    if (!buildingId) {
      setUnits([]);
      return;
    }
    const data = await fetchJSON(`/buildings/${buildingId}/units`);
    setUnits(Array.isArray(data) ? data : data?.data || []);
  }

  async function loadAppliances(unitId) {
    if (!unitId) {
      setAppliances([]);
      return;
    }
    const data = await fetchJSON(`/units/${unitId}/appliances`);
    setAppliances(Array.isArray(data) ? data : data?.data || []);
  }

  async function loadTenantsList() {
    const data = await fetchJSON(`/tenants`);
    setTenantsList(Array.isArray(data) ? data : data?.data || []);
  }

  async function loadUnitTenants(unitId) {
    if (!unitId) {
      setUnitTenants([]);
      return;
    }
    const data = await fetchJSON(`/units/${unitId}/tenants`);
    setUnitTenants(Array.isArray(data) ? data : data?.data || []);
  }

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadBuildings(), loadAssetModels(), loadTenantsList()]);
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

  // When unit changes, refresh dependent data
  useEffect(() => {
    if (!selectedUnitId) return;
    (async () => {
      try {
        await loadUnitTenants(selectedUnitId);
      } catch (e) {
        setErr(`Failed to load unit data: ${e.message}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnitId]);

  useEffect(() => {
    if (!buildingMenuOpenId) return;

    function handleClickOutside(event) {
      if (event.target.closest("[data-building-menu]")) return;
      setBuildingMenuOpenId(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [buildingMenuOpenId]);

  // Actions
  async function onCreateBuilding(e) {
    e.preventDefault();
    const addressLine = buildingAddress.trim();
    const cityCode = buildingCityCode.trim();
    const city = buildingCity.trim();
    const country = buildingCountry.trim();

    if (!addressLine) return setErr("Address is required.");
    if (!cityCode) return setErr("City code is required.");
    if (!city) return setErr("City is required.");
    if (!country) return setErr("Country is required.");

    const name = addressLine;
    const address = `${addressLine}, ${cityCode} ${city}, ${country}`;

    try {
      setLoading(true);
      await fetchJSON(`/buildings`, {
        method: "POST",
        body: JSON.stringify({ name, address }),
      });
      setBuildingAddress("");
      setBuildingCityCode("");
      setBuildingCity("");
      setBuildingCountry("");
      setBuildingFormVisible(false);
      await loadBuildings();
      setOk("Building created.");
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
        body: JSON.stringify({ unitNumber: label }),
      });
      setUnitLabel("");
      await loadUnits(selectedBuildingId);
      setOk("Unit created.");
      setUnitFormVisible(false);
    } catch (e) {
      setErr(`Create unit failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateTenant(e) {
    e.preventDefault();
    const phone = createTenantPhone.trim();
    if (!phone) return setErr("Tenant phone is required.");

    try {
      setCreatingTenant(true);
      const payload = {
        phone,
        ...(createTenantName.trim() ? { name: createTenantName.trim() } : {}),
        ...(createTenantEmail.trim() ? { email: createTenantEmail.trim() } : {}),
      };
      const created = await fetchJSON(`/tenants`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const createdTenantId = created?.data?.id || created?.id;
      if (selectedUnitId && createdTenantId) {
        await fetchJSON(`/units/${selectedUnitId}/tenants`, {
          method: "POST",
          body: JSON.stringify({ tenantId: createdTenantId }),
        });
      }
      await loadTenantsList();
      if (selectedUnitId) {
        await loadUnitTenants(selectedUnitId);
      }
      setCreateTenantName("");
      setCreateTenantPhone("");
      setCreateTenantEmail("");
      setOk(selectedUnitId ? "Tenant created and assigned." : "Tenant created.");
    } catch (e) {
      setErr(`Create tenant failed: ${e.message}`);
    } finally {
      setCreatingTenant(false);
    }
  }

  async function onCreateAssetModel(e) {
    e.preventDefault();
    const name = assetModelName.trim();
    const category = assetModelCategory.trim();

    if (!name) return setErr("Asset model name is required.");
    if (!category) return setErr("Asset model category is required.");

    try {
      setLoading(true);
      await fetchJSON(`/asset-models`, {
        method: "POST",
        body: JSON.stringify({
          name,
          category,
        }),
      });
      setAssetModelName("");
      setAssetModelCategory(ALLOWED_CATEGORIES[0] || "");
      await loadAssetModels();
      setOk("Asset model created.");
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
    const serial = applianceSerialNumber.trim();

    if (!selectedUnitId) return setErr("Select a unit first.");
    if (!name) return setErr("Appliance name is required.");

    // assetModelId optional but recommended
    const assetModelId = selectedAssetModelId || null;

    try {
      setLoading(true);
      await fetchJSON(`/units/${selectedUnitId}/appliances`, {
        method: "POST",
        body: JSON.stringify({
          name,
          ...(category ? { category } : {}),
          ...(serial ? { serial } : {}),
          ...(assetModelId ? { assetModelId } : {}),
        }),
      });
      setApplianceName("");
      setApplianceCategory("");
      setApplianceSerialNumber("");
      setSelectedAssetModelId("");
      await loadAppliances(selectedUnitId);
      setOk("Appliance created.");
    } catch (e) {
      setErr(`Create appliance failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const filteredBuildings = buildings.filter((b) => {
    const query = buildingSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      (b.name || "").toLowerCase().includes(query) ||
      (b.address || "").toLowerCase().includes(query) ||
      (b.id || "").toLowerCase().includes(query)
    );
  });
  const sortedBuildings = [...filteredBuildings].sort((a, b) => {
    const getValue = (item) => {
      switch (buildingSortKey) {
        case "address":
          return item.address || "";
        case "id":
          return item.id || "";
        case "name":
        default:
          return item.name || "";
      }
    };

    const aVal = getValue(a);
    const bVal = getValue(b);

    return buildingSortDir === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });
  const filteredTenants = tenantsList.filter((t) => {
    if (selectedUnitId) return t.unitId === selectedUnitId || t.unit?.id === selectedUnitId;
    if (selectedBuildingId) return t.unit?.buildingId === selectedBuildingId;
    return true;
  });

  function toggleBuildingSort(key) {
    if (buildingSortKey === key) {
      setBuildingSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setBuildingSortKey(key);
    setBuildingSortDir("asc");
  }

  const content = (
    <PageShell variant="embedded">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PageHeader
          title="Admin Inventory"
          subtitle={
            <span>
              Backend: <code className="code">{API_BASE}</code>
            </span>
          }
          actions={(
            <div className="flex items-center gap-3">
              {loading ? <span className="text-xs text-slate-500">Loading…</span> : null}
              <button
                type="button"
                className="button-primary"
                onClick={() => setBuildingFormVisible((prev) => !prev)}
              >
                {buildingFormVisible ? "Cancel" : "Add"}
              </button>
            </div>
          )}
        />
        <PageContent>
          {notice ? (
            <div className={cn("notice", notice.type === "ok" ? "notice-ok" : "notice-err")}>
              {notice.message}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Buildings</h2>

          {buildingFormVisible ? (
            <div
              className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <form onSubmit={onCreateBuilding} className="grid gap-5">
                <div>
                  <label className="label">Address</label>
                  <input
                    className="input"
                    value={buildingAddress}
                    onChange={(e) => setBuildingAddress(e.target.value)}
                    placeholder="e.g. Bahnhofstrasse 12"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">City code</label>
                    <input
                      className="input"
                      value={buildingCityCode}
                      onChange={(e) => setBuildingCityCode(e.target.value)}
                      placeholder="e.g. 8001"
                    />
                  </div>
                  <div>
                    <label className="label">City</label>
                    <input
                      className="input"
                      value={buildingCity}
                      onChange={(e) => setBuildingCity(e.target.value)}
                      placeholder="e.g. Zürich"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Country</label>
                  <input
                    className="input"
                    value={buildingCountry}
                    onChange={(e) => setBuildingCountry(e.target.value)}
                    placeholder="e.g. Switzerland"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setBuildingFormVisible(false)}
                  >
                    Cancel
                  </button>
                  <button className="button-primary" disabled={loading} type="submit">
                    Save building
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          <div className="flex justify-end">
            <div className="max-w-sm w-full">
              <input
                className="input"
                value={buildingSearch}
                onChange={(e) => setBuildingSearch(e.target.value)}
                placeholder="Search…"
              />
              <div className="text-sm text-slate-600">
                Selected:{" "}
                <strong>{selectedBuilding ? selectedBuilding.name : "—"}</strong>
              </div>
            </div>
          </div>

          {sortedBuildings.length === 0 ? (
            <div className="text-sm text-slate-500 italic">No buildings yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50/70">
                  <tr>
                    {[
                      { key: "name", label: "Name" },
                      { key: "address", label: "Address" },
                      { key: "id", label: "Building ID" },
                    ].map(({ key, label }) => (
                      <th key={key} className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none hover:text-slate-800 transition-colors"
                          onClick={() => toggleBuildingSort(key)}
                        >
                          {label}
                          <span className="inline-flex flex-col leading-none -space-y-0.5">
                            <span className={cn("text-[8px]", buildingSortKey === key && buildingSortDir === "asc" ? "text-indigo-600" : "text-slate-300")}>▲</span>
                            <span className={cn("text-[8px]", buildingSortKey === key && buildingSortDir === "desc" ? "text-indigo-600" : "text-slate-300")}>▼</span>
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="h-12 px-4 text-right align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(buildingsTableExpanded ? sortedBuildings : sortedBuildings.slice(0, 5)).map((b) => (
                    <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 align-middle text-sm text-slate-700">
                        <Link href={`/admin-inventory/buildings/${b.id}`} className="font-semibold text-slate-900 hover:underline">
                          {b.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-700">
                        {b.address || "—"}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-700">
                        <code className="code-small">{b.id}</code>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-700 text-right">
                        <div className="relative inline-block text-left" data-building-menu>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                            onClick={() =>
                              setBuildingMenuOpenId((prev) => (prev === b.id ? null : b.id))
                            }
                          >
                            ⋮
                          </button>
                          {buildingMenuOpenId === b.id ? (
                            <div className="absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-lg border border-slate-200 bg-white shadow-lg">
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  setSelectedBuildingId(b.id);
                                  setBuildingMenuOpenId(null);
                                }}
                              >
                                Set active
                              </button>
                              <Link
                                href={`/admin-inventory/buildings/${b.id}`}
                                className="block px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                onClick={() => setBuildingMenuOpenId(null)}
                              >
                                View →
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedBuildings.length > 5 && (
                <div
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors text-sm text-slate-500 select-none"
                  onClick={() => setBuildingsTableExpanded((e) => !e)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={cn("w-4 h-4 transition-transform duration-200", buildingsTableExpanded ? "rotate-180" : "")}
                  >
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                  {buildingsTableExpanded
                    ? "Show less"
                    : `Show all ${sortedBuildings.length} buildings`}
                </div>
              )}
            </div>
          )}
          </div>



          <div className="mt-10 border-t border-slate-200 pt-5">
            <div className="text-sm text-slate-500">
              Tip: if this page can’t load data, verify the API is running on{" "}
              <code className="code-small">{API_BASE}</code> and that CORS is enabled.
            </div>
          </div>
        </PageContent>
      </div>
    </PageShell>
  );

  return <AppShell role="MANAGER">{content}</AppShell>;
}

