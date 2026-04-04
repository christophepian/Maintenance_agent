import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;

  // Build path: /rent-adjustments/:id or /rent-adjustments/:id/approve etc.
  let backendPath = `/rent-adjustments/${id}`;
  if (Array.isArray(id)) {
    const adjId = id[0];
    const rest = id.slice(1).join("/");
    backendPath = `/rent-adjustments/${adjId}${rest ? "/" + rest : ""}`;
  }

  await proxyToBackend(req, res, backendPath);
}
