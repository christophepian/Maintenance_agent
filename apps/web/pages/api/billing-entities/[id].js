export default async function handler(req, res) {
  const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3001";
  const authHeader = req.headers["authorization"];
  const { id } = req.query;

  try {
    if (!id) return res.status(400).json({ error: "Missing billing entity id" });

    if (req.method === "GET") {
      const response = await fetch(`${API_BASE_URL}/billing-entities/${id}`, {
        headers: authHeader ? { authorization: authHeader } : {},
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    if (req.method === "PATCH") {
      const response = await fetch(`${API_BASE_URL}/billing-entities/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { authorization: authHeader } : {}),
        },
        body: JSON.stringify(req.body || {}),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    if (req.method === "DELETE") {
      const response = await fetch(`${API_BASE_URL}/billing-entities/${id}`, {
        method: "DELETE",
        headers: authHeader ? { authorization: authHeader } : {},
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Billing entity proxy error:", error);
    return res.status(500).json({ error: "Internal proxy error" });
  }
}
