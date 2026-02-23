// Frontend proxy for DELETE /api/notifications/:id
export default async function handler(req, res) {
  const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3001";
  const authHeader = req.headers["authorization"];
  const { id } = req.query;

  try {
    if (req.method === "DELETE") {
      const response = await fetch(`${API_BASE_URL}/notifications/${id}`, {
        method: "DELETE",
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
    console.error("Delete notification proxy error:", error);
    return res.status(500).json({ error: "Internal proxy error" });
  }
}
