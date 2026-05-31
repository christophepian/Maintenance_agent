import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
  }
  await proxyToBackend(req, res, "/legal/ingest");
}
