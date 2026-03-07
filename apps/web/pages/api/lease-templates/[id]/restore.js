import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  await proxyToBackend(req, res, `/lease-templates/${id}/restore`);
}
