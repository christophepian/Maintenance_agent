// Frontend proxy for /api/tenants endpoints
export default async function handler(req, res) {
  const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3001";
  const authHeader = req.headers["authorization"];

  try {
    if (req.method === "GET") {
      // GET /api/tenants?phone=... or list all tenants when phone is omitted
      const { phone, includeInactive } = req.query;
      const apiUrl = new URL(`${API_BASE_URL}/tenants`);
      if (phone) {
        apiUrl.searchParams.set("phone", phone);
      }
      if (includeInactive) {
        apiUrl.searchParams.set("includeInactive", includeInactive);
      }

      const response = await fetch(apiUrl.toString(), {
        headers: authHeader ? { authorization: authHeader } : undefined,
      });
      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      // POST /api/tenants
      const response = await fetch(`${API_BASE_URL}/tenants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { authorization: authHeader } : {}),
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("Tenant API error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
