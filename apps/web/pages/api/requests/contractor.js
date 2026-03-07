import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  const { contractorId } = req.query;
  if (!contractorId) {
    return res.status(400).json({ error: "Missing contractorId query parameter" });
  }
  await proxyToBackend(req, res, `/requests/contractor/${contractorId}`);
}
