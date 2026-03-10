import { proxyToBackend } from "../../../lib/proxy";

/**
 * Proxy POST /api/requests/approve?id=X → PATCH /requests/X/status
 *
 * Migrated to proxyToBackend in frontend-debt-cleanup slice.
 * Transforms: POST → PATCH, sets fixed body { status: "APPROVED" }.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Missing query param: id" },
    });
  }

  // Transform: POST → PATCH /requests/{id}/status with fixed approval body
  req.body = { status: "APPROVED" };
  await proxyToBackend(req, res, `/requests/${id}/status`, { method: "PATCH" });
}
