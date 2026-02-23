// Frontend proxy for owner approval endpoints

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3001";

export default async function handler(req, res) {
  const { id, action } = req.query;
  const authHeader = req.headers["authorization"];

  if (req.method === "GET" && !id) {
    // GET /owner/pending-approvals
    const buildingId = req.query.buildingId || "";
    const queryString = buildingId ? `?buildingId=${buildingId}` : "";
    const url = `${API_BASE_URL}/owner/pending-approvals${queryString}`;

    try {
      const response = await fetch(url, {
        headers: authHeader ? { authorization: authHeader } : undefined,
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  }

  if (req.method === "POST" && id && action === "approve") {
    // POST /requests/:id/owner-approve
    const url = `${API_BASE_URL}/requests/${id}/owner-approve`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ? { authorization: authHeader } : {}) },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) {
      return res.status(500).json({ error: "Failed to approve request" });
    }
  }

  if (req.method === "POST" && id && action === "reject") {
    // POST /requests/:id/owner-reject
    const url = `${API_BASE_URL}/requests/${id}/owner-reject`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ? { authorization: authHeader } : {}) },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) {
      return res.status(500).json({ error: "Failed to reject request" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
