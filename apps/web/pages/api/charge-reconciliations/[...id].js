import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;

  // Build path: /charge-reconciliations/:id or /charge-reconciliations/:id/action
  // or /charge-reconciliations/:id/lines/:lid
  let backendPath = `/charge-reconciliations/${id}`;
  if (Array.isArray(id)) {
    const reconId = id[0];
    const rest = id.slice(1).join("/");
    backendPath = `/charge-reconciliations/${reconId}${rest ? "/" + rest : ""}`;
  }

  await proxyToBackend(req, res, backendPath);
}
