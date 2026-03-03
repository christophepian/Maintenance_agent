const API = process.env.API_BASE_URL || "http://127.0.0.1:3001";

export default async function handler(req, res) {
  const qs = new URLSearchParams(req.query).toString();
  const url = `${API}/tenant-portal/notifications/mark-all-read${qs ? `?${qs}` : ""}`;
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": "TENANT" },
      body: req.body ? JSON.stringify(req.body) : undefined,
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: "Upstream error" });
  }
}
