export default async function handler(req, res) {
  const { contractorId } = req.query;

  if (!contractorId) {
    return res.status(400).json({ error: "Missing contractorId query parameter" });
  }

  const backendUrl = process.env.API_BASE_URL || "http://127.0.0.1:3001";

  try {
    if (req.method === "GET") {
      // GET /api/requests/contractor/:contractorId
      const response = await fetch(`${backendUrl}/requests/contractor/${contractorId}`);
      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("Contractor request proxy error:", e);
    return res.status(500).json({
      error: "Failed to fetch contractor requests",
      details: String(e?.message || e),
    });
  }
}
