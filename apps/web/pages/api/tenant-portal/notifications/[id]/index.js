const API = process.env.API_BASE_URL || "http://127.0.0.1:3001";

export default async function handler(req, res) {
  const { id } = req.query;

  // DELETE /tenant-portal/notifications/:id
  if (req.method === "DELETE") {
    try {
      const upstream = await fetch(`${API}/tenant-portal/notifications/${id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json", "x-dev-role": "TENANT" },
      });
      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (e) {
      res.status(502).json({ error: "Upstream error" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
