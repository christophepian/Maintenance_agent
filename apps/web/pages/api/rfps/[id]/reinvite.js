import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  await proxyToBackend(req, res, `/rfps/${id}/reinvite`);
}
