import { proxyToBackend } from "../../../../../lib/proxy";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const { slotId } = req.query;
  await proxyToBackend(req, res, `/tenant-portal/slots/${slotId}/accept`);
}
