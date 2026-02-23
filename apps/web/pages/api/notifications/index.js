// Frontend proxy for /api/notifications endpoints
export default async function handler(req, res) {
  const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3001";
  const authHeader = req.headers["authorization"];

  try {
    if (req.method === "GET") {
      // GET /api/notifications?limit=...&offset=...&isRead=...
      const { limit, offset, unreadOnly } = req.query;
      const apiUrl = new URL(`${API_BASE_URL}/notifications`);
      if (limit) apiUrl.searchParams.set("limit", limit);
      if (offset) apiUrl.searchParams.set("offset", offset);
      if (unreadOnly !== undefined) apiUrl.searchParams.set("unreadOnly", unreadOnly);

      const response = await fetch(apiUrl.toString(), {
        headers: authHeader ? { authorization: authHeader } : {},
      });
      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Notification proxy error:", error);
    return res.status(500).json({ error: "Internal proxy error" });
  }
}
