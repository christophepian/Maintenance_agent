const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3001";

export default async function handler(req, res) {
  const { buildingId } = req.query;

  try {
    if (req.method === "GET") {
      const queryParams = buildingId ? `?buildingId=${buildingId}` : "";
      const apiRes = await fetch(`${API_BASE_URL}/approval-rules${queryParams}`, {
        headers: {
          Authorization: req.headers.authorization || "",
        },
      });
      const data = await apiRes.json();
      return res.status(apiRes.status).json(data);
    }

    if (req.method === "POST") {
      const apiRes = await fetch(`${API_BASE_URL}/approval-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.authorization || "",
        },
        body: JSON.stringify(req.body),
      });
      const data = await apiRes.json();
      return res.status(apiRes.status).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Approval rules proxy error:", error);
    return res.status(500).json({ error: "Failed to fetch approval rules" });
  }
}
