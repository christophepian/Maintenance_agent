// Proxy for /api/inventory/* endpoints
export default async function handler(req, res) {
  const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3001";
  const { method } = req;

  try {
    // GET /api/inventory/buildings
    if (method === "GET" && req.url === "/api/inventory/buildings") {
      const response = await fetch(`${API_BASE_URL}/buildings`);
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // POST /api/inventory/buildings
    if (method === "POST" && req.url === "/api/inventory/buildings") {
      const response = await fetch(`${API_BASE_URL}/buildings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // GET /api/inventory/buildings/:id/units
    const buildingUnitsMatch = req.url.match(/^\/api\/inventory\/buildings\/([^/]+)\/units$/);
    if (method === "GET" && buildingUnitsMatch) {
      const buildingId = buildingUnitsMatch[1];
      const response = await fetch(`${API_BASE_URL}/buildings/${buildingId}/units`);
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // POST /api/inventory/buildings/:id/units
    if (method === "POST" && buildingUnitsMatch) {
      const buildingId = buildingUnitsMatch[1];
      const response = await fetch(`${API_BASE_URL}/buildings/${buildingId}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // GET /api/inventory/units/:id/appliances
    const appliancesMatch = req.url.match(/^\/api\/inventory\/units\/([^/]+)\/appliances$/);
    if (method === "GET" && appliancesMatch) {
      const unitId = appliancesMatch[1];
      const response = await fetch(`${API_BASE_URL}/units/${unitId}/appliances`);
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // POST /api/inventory/units/:id/appliances
    if (method === "POST" && appliancesMatch) {
      const unitId = appliancesMatch[1];
      const response = await fetch(`${API_BASE_URL}/units/${unitId}/appliances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // GET /api/inventory/asset-models
    if (method === "GET" && req.url === "/api/inventory/asset-models") {
      const response = await fetch(`${API_BASE_URL}/asset-models`);
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // POST /api/inventory/asset-models
    if (method === "POST" && req.url === "/api/inventory/asset-models") {
      const response = await fetch(`${API_BASE_URL}/asset-models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (e) {
    console.error("Inventory proxy error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
