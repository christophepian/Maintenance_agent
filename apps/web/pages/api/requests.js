import { proxyToBackend } from "../../lib/proxy";

/**
 * Proxy /api/requests → backend /requests
 *
 * Migrated to proxyToBackend in frontend-debt-cleanup slice.
 * Legacy compat: POST payloads with "text" field are mapped to "description".
 */
export default async function handler(req, res) {
  // Legacy compat: some callers send "text" instead of "description"
  if (req.method === "POST" && req.body?.text && !req.body?.description) {
    req.body.description = req.body.text;
  }
  await proxyToBackend(req, res, "/requests");
}
