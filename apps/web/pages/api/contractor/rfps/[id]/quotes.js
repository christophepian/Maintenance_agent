import { proxyToBackend } from "../../../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  await proxyToBackend(req, res, `/contractor/rfps/${id}/quotes`, {
    headers: { "X-Dev-Role": "CONTRACTOR" },
  });
}
